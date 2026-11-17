"""
app/services/insights/engine.py

Runs the rules for one client, scores what they found, and saves the cards.

Called by the nightly scheduled job, and by hand from an endpoint when you
want to regenerate now.

What it does NOT do: choose which cards to show. It saves them all; the
endpoint picks the top few for whoever is looking, because a director and a
marketing user want different ones.
"""
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.branch import Branch                                  
from app.models.insights import (                                      
    CONFIDENCE_EARLY, CONFIDENCE_FAIR, CONFIDENCE_SOLID, Insight,
)
from app.models.insights_run import (                                  
    TRIGGER_MANUAL, InsightRun,
)
from app.models.orders import Order, OrderStatus                     
from app.models.table import Table                                    
# Importing the rules package is what registers the rules. Without this line
# the registry is empty and the run does nothing, silently.
from app.services.insights import rules as _rules                     
from app.services.insights.registry import RULES, Card, Context, Rule, fingerprint
from app.services.insights.settings import get_settings
from app.services.insights.sources import runnable_source_keys, source_statuses

log = logging.getLogger(__name__)

LONDON = "Europe/London"

# --- Confidence: how far above its own minimum a finding is. ---------------
# Internal mechanics, not business thresholds, so these are constants rather
# than settings. Move them into the catalogue if the client ever wants them.
FAIR_AT = 2.0       # twice the minimum
SOLID_AT = 4.0      # four times the minimum
CONFIDENCE_FACTORS = {
    CONFIDENCE_EARLY: 0.6,
    CONFIDENCE_FAIR: 0.85,
    CONFIDENCE_SOLID: 1.0,
}

# --- Recency: only cards about a CHANGE lose urgency as they age. ----------
DECAY_OVER_DAYS = 30.0
DECAY_FLOOR = 0.3

# How long to keep run records. One a night per client is nothing, but
# unbounded is untidy, and nobody looks back further than this.
KEEP_RUNS_DAYS = 90

# Column limits in the insights table. Rules should write short text; this is
# only a safety net so a long sentence cannot fail the insert.
MAX_HEADLINE = 300
MAX_DETAIL = 800
MAX_SUGGESTION = 500
MAX_SUBJECT_LABEL = 120


@dataclass
class RunReport:
    """What one run did. Worth logging, and worth showing on an admin screen."""
    tenant_id: uuid.UUID
    started_at: datetime
    rules_run: list[str] = field(default_factory=list)
    rules_skipped: dict[str, str] = field(default_factory=dict)
    rules_failed: dict[str, str] = field(default_factory=dict)
    created: int = 0
    updated: int = 0
    expired: int = 0
    not_enough_data: bool = False
    orders_in_window: int = 0

    def summary(self) -> str:
        if self.not_enough_data:
            return f"not enough data yet ({self.orders_in_window} orders)"
        return (f"{len(self.rules_run)} rules ran, {self.created} new, "
                f"{self.updated} updated, {self.expired} expired, "
                f"{len(self.rules_skipped)} waiting, {len(self.rules_failed)} failed")


# --------------------------------------------------------------------------
# Scoring: pure functions, no database, so they can be tested directly
# --------------------------------------------------------------------------
def confidence_for(data_points: int, data_needed: int) -> str:
    """How much to trust a finding, from how far above its minimum it is."""
    if data_needed <= 0:
        return CONFIDENCE_EARLY
    ratio = data_points / data_needed
    if ratio >= SOLID_AT:
        return CONFIDENCE_SOLID
    if ratio >= FAIR_AT:
        return CONFIDENCE_FAIR
    return CONFIDENCE_EARLY


def recency_factor(first_seen_at: datetime, now: datetime, decays: bool) -> float:
    """A card about a CHANGE loses urgency with age. A standing condition does
    not: a dish dead for 90 days matters more than one dead for 21, and the
    rule raises its own impact to say so."""
    if not decays:
        return 1.0
    age_days = max(0.0, (now - first_seen_at).total_seconds() / 86400.0)
    return max(DECAY_FLOOR, 1.0 - age_days / DECAY_OVER_DAYS)


def importance_for(impact: float, confidence: str, recency: float) -> float:
    return round(impact * CONFIDENCE_FACTORS[confidence] * recency, 4)


def _fit(text: str, limit: int) -> str:
    """Keep text inside its column. A rule writing something this long is a
    bug in the rule, but a failed insert would lose the whole run."""
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


# --------------------------------------------------------------------------
# Putting the context together
# --------------------------------------------------------------------------
def _branch_ids(db: Session, tenant_id: uuid.UUID) -> tuple[uuid.UUID, ...]:
    return tuple(
        db.execute(select(Branch.id).where(Branch.tenant_id == tenant_id).order_by(Branch.id))
        .scalars()
    )


def orders_in_window(db: Session, tenant_id: uuid.UUID, since: datetime, until: datetime) -> int:
    """Orders have no tenant of their own, so this goes Order -> Table -> Branch."""
    return db.execute(
        select(func.count(Order.id))
        .join(Table, Table.id == Order.table_id)
        .join(Branch, Branch.id == Table.branch_id)
        .where(
            Branch.tenant_id == tenant_id,
            Order.status != OrderStatus.cancelled,
            Order.created_at >= since,
            Order.created_at < until,
        )
    ).scalar_one()


# --------------------------------------------------------------------------
# The run
# --------------------------------------------------------------------------
def run_for_tenant(
    db: Session,
    tenant_id: uuid.UUID,
    now: datetime | None = None,
    trigger: str = TRIGGER_MANUAL,
) -> RunReport:
    """Work out this client's insights, and leave a record that it happened.

    The record is written and committed BEFORE the work starts, so a crash
    still leaves evidence: a row with no finished_at means a run began and
    never came back. Without that, a nightly job that quietly stopped would
    show up weeks later as a page gone empty, with nothing to explain it.
    """
    now = now or datetime.now(timezone.utc)
    report = RunReport(tenant_id=tenant_id, started_at=now)

    run_row = InsightRun(tenant_id=tenant_id, started_at=now, trigger=trigger, ok=False)
    db.add(run_row)
    db.commit()                 # on its own, so a crash cannot roll it away

    try:
        _compute(db, tenant_id, now, report)
    except Exception as exc:
        # The session is dirty after a failure part-way through, so clear it
        # before writing the outcome -- otherwise the record cannot be saved.
        db.rollback()
        report.rules_failed["__run__"] = f"{type(exc).__name__}: {exc}"
        _record_run(db, run_row, report, ok=False)
        raise

    _record_run(db, run_row, report, ok=not report.rules_failed)
    log.info("insights for tenant %s: %s", tenant_id, report.summary())
    return report


def _plain_json(value):
    """Evidence goes into a JSON column, and a rule can easily leave a UUID or
    a date in it. Turn those into text here rather than failing the whole run."""
    return json.loads(json.dumps(value, default=str))


def _record_run(db: Session, run_row: InsightRun, report: RunReport, ok: bool) -> None:
    run_row.finished_at = datetime.now(timezone.utc)
    run_row.ok = ok
    run_row.summary = report.summary()[:300]
    run_row.rules_run = len(report.rules_run)
    run_row.cards_created = report.created
    run_row.cards_updated = report.updated
    run_row.cards_expired = report.expired
    run_row.orders_in_window = report.orders_in_window
    run_row.not_enough_data = report.not_enough_data
    # Waiting is normal: a source is not connected yet. Failing is a bug.
    run_row.rules_waiting = dict(report.rules_skipped) or None
    run_row.rules_failed = dict(report.rules_failed) or None

    # Keep the log tidy. One row a night per client is nothing, but unbounded
    # is untidy and nobody looks back further than this.
    db.execute(
        delete(InsightRun).where(
            InsightRun.tenant_id == run_row.tenant_id,
            InsightRun.started_at < run_row.started_at - timedelta(days=KEEP_RUNS_DAYS),
        )
    )
    db.commit()


def _compute(db: Session, tenant_id: uuid.UUID, now: datetime, report: RunReport) -> None:
    """The actual work. Split out so run_for_tenant can record the outcome
    whether this returns or raises."""
    settings = get_settings(db, tenant_id)
    window_days = int(settings["window_days"])
    since = now - timedelta(days=window_days)
    prev_since = since - timedelta(days=window_days)

    # Everything already saved for this client. One query: the table is small,
    # so this avoids a SELECT per card.
    existing = {
        row.fingerprint: row
        for row in db.execute(select(Insight).where(Insight.tenant_id == tenant_id)).scalars()
    }

    report.orders_in_window = orders_in_window(db, tenant_id, since, now)
    if report.orders_in_window < settings["min_orders_to_trust"]:
        # Not enough trading to say anything. Still prune, so stale cards from
        # a busier period do not linger.
        report.not_enough_data = True
        report.expired = _prune(db, existing, set(), now, settings)
        db.commit()
        return

    statuses = source_statuses(db, tenant_id, window_days=window_days, now=now)
    available = set(runnable_source_keys(statuses))

    ctx = Context(
        db=db,
        tenant_id=tenant_id,
        branch_ids=_branch_ids(db, tenant_id),
        settings=settings,
        now=now,
        since=since,
        prev_since=prev_since,
        london=ZoneInfo(LONDON),
    )

    confirmed: set[str] = set()

    for rule_obj in RULES.values():
        missing = [s for s in rule_obj.requires if s not in available]
        if missing:
            report.rules_skipped[rule_obj.key] = "waiting for " + ", ".join(missing)
            continue

        try:
            cards = rule_obj.run(ctx) or []
        except Exception as exc:        # one broken rule must not stop the rest
            log.exception("insight rule %s failed for tenant %s", rule_obj.key, tenant_id)
            report.rules_failed[rule_obj.key] = f"{type(exc).__name__}: {exc}"
            # A failed query leaves the transaction aborted, which would make
            # every rule after this one fail with it. Clear it.
            db.rollback()
            continue

        report.rules_run.append(rule_obj.key)
        for card in cards:
            fp = fingerprint(rule_obj.key, card.branch_id, *card.subject_parts)
            if fp in confirmed:
                # A rule emitted the same subject twice. That is a bug in the
                # rule, but inserting twice would break the unique constraint
                # and lose the whole run, so skip it and say so.
                log.warning(
                    "rule %s produced the same card twice (%s); ignoring the duplicate",
                    rule_obj.key, card.subject_label or card.subject_parts,
                )
                continue
            _save_card(db, tenant_id, rule_obj, card, existing, now, window_days, report)
            confirmed.add(fp)

    report.expired = _prune(db, existing, confirmed, now, settings)
    db.commit()


def _save_card(
    db: Session,
    tenant_id: uuid.UUID,
    rule_obj: Rule,
    card: Card,
    existing: dict[str, Insight],
    now: datetime,
    window_days: int,
    report: RunReport,
) -> str:
    fp = fingerprint(rule_obj.key, card.branch_id, *card.subject_parts)
    row = existing.get(fp)

    headline = _fit(card.headline, MAX_HEADLINE)
    detail = _fit(card.detail, MAX_DETAIL)
    suggestion = _fit(card.suggestion, MAX_SUGGESTION)

    confidence = confidence_for(card.data_points, card.data_needed)
    # Recency needs when this advice FIRST appeared, which only the stored row
    # knows -- so scoring has to happen after the lookup, not before.
    first_seen = row.first_seen_at if row is not None else now
    importance = importance_for(card.impact, confidence, recency_factor(first_seen, now, rule_obj.decays))

    if row is None:
        db.add(Insight(
            tenant_id=tenant_id,
            branch_id=card.branch_id,
            rule_key=rule_obj.key,
            fingerprint=fp,
            subject_label=_fit(card.subject_label or "", MAX_SUBJECT_LABEL) or None,
            headline=headline,
            detail=detail,
            suggestion=suggestion,
            ai_text=None,
            evidence=_plain_json(card.evidence),
            importance=importance,
            confidence=confidence,
            window_days=window_days,
            first_seen_at=now,
            last_computed_at=now,
        ))
        report.created += 1
        return fp

    # Same advice as before: update the numbers, keep first_seen_at.
    text_changed = (
        row.headline != headline or row.detail != detail or row.suggestion != suggestion
    )
    row.headline = headline
    row.detail = detail
    row.suggestion = suggestion
    row.subject_label = _fit(card.subject_label or "", MAX_SUBJECT_LABEL) or None
    row.evidence = _plain_json(card.evidence)
    row.importance = importance
    row.confidence = confidence
    row.window_days = window_days
    row.last_computed_at = now
    if text_changed:
        # The rephrased version quotes the old numbers, so it is now wrong.
        # Clearing it means the next pass rewrites it.
        row.ai_text = None
    report.updated += 1
    return fp


def _prune(
    db: Session,
    existing: dict[str, Insight],
    confirmed: set[str],
    now: datetime,
    settings: dict[str, float],
) -> int:
    """Delete cards no rule confirmed this run and that are past their expiry.

    The delay is deliberate: a measurement sitting on a threshold would
    otherwise make a card flicker on and off night after night.
    """
    cutoff = now - timedelta(days=int(settings["card_expiry_days"]))
    removed = 0
    for fp, row in existing.items():
        if fp in confirmed:
            continue
        if row.last_computed_at < cutoff:
            db.delete(row)
            removed += 1
    return removed


# ==========================================================================
# "When were these last worked out?" -- so a job that stops is visible
# ==========================================================================
STATE_NEVER = "never"              # nothing has ever run
STATE_RUNNING = "running"          # started recently, not finished yet
STATE_UNFINISHED = "unfinished"    # started a while ago and never came back
STATE_FAILED = "failed"            # finished, but rules failed
STATE_OVERDUE = "overdue"          # succeeded, but too long ago
STATE_FRESH = "fresh"              # succeeded recently

# A run still going after this long has almost certainly died.
ASSUME_DEAD_AFTER_HOURS = 2.0

# Which states mean the cards on screen cannot be trusted to be current.
NEEDS_REFRESH = (STATE_NEVER, STATE_UNFINISHED, STATE_FAILED, STATE_OVERDUE)


def last_run(db: Session, tenant_id: uuid.UUID) -> InsightRun | None:
    """The most recent attempt, successful or not."""
    return db.execute(
        select(InsightRun)
        .where(InsightRun.tenant_id == tenant_id)
        .order_by(InsightRun.started_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _spoken_age(hours: float) -> str:
    if hours < 1:
        return f"{int(hours * 60)} minutes ago"
    if hours < 24:
        whole = int(round(hours))
        return "an hour ago" if whole == 1 else f"{whole} hours ago"
    days = int(round(hours / 24))
    return "yesterday" if days == 1 else f"{days} days ago"


def run_status(run: InsightRun | None, now: datetime, stale_after_hours: float) -> dict:
    """What to tell the person about how current the insights are.

    The whole point of this is that a silent failure becomes a visible one. A
    nightly job that stops would otherwise show up weeks later as a page that
    has gone empty, with nothing to explain why.
    """
    if run is None:
        return {
            "state": STATE_NEVER,
            "message": "These insights have not been worked out yet.",
            "last_run_at": None, "age_hours": None, "trigger": None,
            "summary": None, "rules_failed": None,
            "needs_refresh": True,
        }

    reference = run.finished_at or run.started_at
    age_hours = max(0.0, (now - reference).total_seconds() / 3600.0)
    spoken = _spoken_age(age_hours)

    if run.finished_at is None:
        if age_hours <= ASSUME_DEAD_AFTER_HOURS:
            state = STATE_RUNNING
            message = "The insights are being worked out now."
        else:
            state = STATE_UNFINISHED
            message = (
                f"A run started {spoken} and never finished. Something stopped it "
                f"part-way, so these cards may be out of date."
            )
    elif not run.ok:
        failed = len(run.rules_failed or {})
        state = STATE_FAILED
        message = (
            f"The last run finished {spoken} with "
            f"{failed} insight{'s' if failed != 1 else ''} failing. The rest are fine."
        )
    elif age_hours > stale_after_hours:
        state = STATE_OVERDUE
        message = (
            f"These insights were last worked out {spoken}. The overnight job may "
            f"have stopped."
        )
    else:
        state = STATE_FRESH
        message = f"Last worked out {spoken}."

    return {
        "state": state,
        "message": message,
        "last_run_at": reference.isoformat(),
        "age_hours": round(age_hours, 1),
        "trigger": run.trigger,
        "summary": run.summary,
        "rules_failed": run.rules_failed or None,
        "needs_refresh": state in NEEDS_REFRESH,
    }