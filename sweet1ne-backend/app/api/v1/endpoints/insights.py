"""
app/api/v1/endpoints/insights.py

The Insights page, its feedback, and its Settings tab.

Mount it alongside your other v1 routers, e.g.

    api_router.include_router(insights.router, prefix="/insights", tags=["insights"])

so the paths come out as /api/v1/insights, /api/v1/insights/settings and so on.

PERMISSIONS: everything here uses access_reports for now, because you decided
to do permissions last. The one rule enforced properly is that the Settings
tab is central staff only -- hiding the tab in the browser is not a control,
so the endpoints refuse branch staff outright. When a dedicated permission
exists, it replaces access_reports one line at a time.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission      
from app.db.session import SessionLocal, get_db                     
from app.models.branch import Branch                                
from app.models.insights import Insight                              
from app.models.insights_feedback import (                           
    ACTION_DONE, ACTION_NOT_USEFUL, ACTION_SNOOZED, InsightFeedback,
)
from app.models.insights_run import (                                
    TRIGGER_FALLBACK, TRIGGER_MANUAL, InsightRun,
)
from app.services.insights import engine
from app.services.insights.registry import (
    AUDIENCE_DIRECTOR, AUDIENCE_MANAGER, AUDIENCE_MARKETING, RULES,
    rule_keys_for,
)
from app.services.insights.settings import (
    CATALOGUE, GROUPS, SettingOutOfRange, UnknownSetting, get_settings,
    reset_setting, set_setting, settings_for_tab,
)
from app.services.insights.sources import (
    STATE_NOT_CONNECTED, runnable_source_keys, source_statuses,
)

router = APIRouter()
log = logging.getLogger(__name__)

VALID_ACTIONS = (ACTION_DONE, ACTION_NOT_USEFUL, ACTION_SNOOZED)


# ==========================================================================
# Who sees what
# ==========================================================================
def audiences_for(staff: CurrentStaff) -> list[str]:
    """Turn this person's permissions into the audiences they belong to.

    A person can be more than one. A super admin is all three.
    """
    central = staff.branch_id is None
    reports = staff.is_super_admin or "access_reports" in staff.permissions
    marketing = staff.is_super_admin or "manage_marketing" in staff.permissions

    audiences = []
    if reports and central:
        audiences.append(AUDIENCE_DIRECTOR)
    if reports and not central:
        audiences.append(AUDIENCE_MANAGER)
    if marketing:
        audiences.append(AUDIENCE_MARKETING)
    return audiences


def _central_only(staff: CurrentStaff) -> None:
    """The Settings tab is not for branch staff. Enforced here, not in the UI:
    a hidden tab is not a permission."""
    if staff.branch_id is not None and not staff.is_super_admin:
        raise HTTPException(status_code=403, detail="Central staff only.")


# ==========================================================================
# Reading feedback
# ==========================================================================
def _latest_feedback(db: Session, tenant_id, fingerprints: list[str]) -> dict:
    """The most recent decision per fingerprint.

    Feedback rows are never updated, so "current state" means "newest row".
    Resolved in Python rather than with DISTINCT ON: the table is small, and
    this is far easier to follow and change.
    """
    if not fingerprints:
        return {}
    rows = db.execute(
        select(InsightFeedback)
        .where(
            InsightFeedback.tenant_id == tenant_id,
            InsightFeedback.fingerprint.in_(fingerprints),
        )
        .order_by(InsightFeedback.created_at)
    ).scalars()
    latest = {}
    for row in rows:                    # ordered oldest first, so the last wins
        latest[row.fingerprint] = row
    return latest


def _hidden_until(feedback, snooze_days: float) -> datetime | None:
    """When a card becomes visible again, or None if it is not hidden."""
    if feedback is None:
        return None
    if feedback.action in (ACTION_DONE, ACTION_NOT_USEFUL):
        return datetime.max.replace(tzinfo=timezone.utc)        # hidden for good
    if feedback.action == ACTION_SNOOZED:
        return feedback.created_at + timedelta(days=snooze_days)
    return None


# ==========================================================================
# Shaping a card for the page
# ==========================================================================
def _card_text(row: Insight) -> dict:
    """Which wording to show.

    The rephrased version is used when it is there and complete; otherwise the
    rule's own sentences, which are always present and always checkable. So a
    failed, slow, switched-off or not-yet-run AI step costs nothing.
    """
    ai = row.ai_text or {}
    complete = all(ai.get(k) for k in ("headline", "detail", "suggestion"))
    if complete:
        return {
            "headline": ai["headline"],
            "detail": ai["detail"],
            "suggestion": ai["suggestion"],
            "rephrased": True,
            # Kept so the exact figures are one click away, and so anyone can
            # check the rephrasing against what the rule actually said.
            "original": {
                "headline": row.headline,
                "detail": row.detail,
                "suggestion": row.suggestion,
            },
        }
    return {
        "headline": row.headline,
        "detail": row.detail,
        "suggestion": row.suggestion,
        "rephrased": False,
        "original": None,
    }


def _shape_card(row: Insight, now: datetime, feedback, branch_lookup: dict) -> dict:
    days_old = max(0, int((now - row.first_seen_at).total_seconds() // 86400))
    rule = RULES.get(row.rule_key)
    return {
        "fingerprint": row.fingerprint,
        "rule_key": row.rule_key,
        "rule_title": rule.title if rule else row.rule_key,
        "subject": row.subject_label,
        "branch_id": str(row.branch_id) if row.branch_id else None,
        "branch": branch_lookup.get(row.branch_id),
        "scope": "branch" if row.branch_id else "company",
        **_card_text(row),
        "evidence": row.evidence or {},
        "importance": round(row.importance, 4),
        "confidence": row.confidence,
        "window_days": row.window_days,
        "days_old": days_old,
        "first_seen_at": row.first_seen_at.isoformat(),
        "last_computed_at": row.last_computed_at.isoformat(),
        "feedback": (
            {
                "action": feedback.action,
                "at": feedback.created_at.isoformat(),
                "note": feedback.note,
            }
            if feedback is not None else None
        ),
    }


# ==========================================================================
# The safety net: work the insights out if nothing has for too long
# ==========================================================================
def _refresh_in_background(tenant_id: uuid.UUID) -> None:
    """Run the engine after the response has gone out.

    Its own session on purpose: the request's session is closed by the time
    this runs. And it swallows everything, because a background task that
    raises only produces noise in the log after the person has already been
    served -- the failure is recorded in insight_runs either way.
    """
    with SessionLocal() as db:
        try:
            engine.run_for_tenant(db, tenant_id, trigger=TRIGGER_FALLBACK)
        except Exception:
            log.exception("background insight refresh failed for tenant %s", tenant_id)


# ==========================================================================
# GET /insights -- the page
# ==========================================================================
@router.get("")
def read_insights(
    background: BackgroundTasks,
    branch_id: uuid.UUID | None = None,
    include_hidden: bool = Query(False, description="Also return cards marked done, not useful or snoozed."),
    limit: int | None = Query(None, ge=1, le=50, description="Overrides the cards_shown setting."),
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """The cards for whoever is asking, most important first."""
    now = datetime.now(timezone.utc)
    settings = get_settings(db, staff.tenant_id)

    # How current are these cards? This is what turns a nightly job that
    # quietly stopped into something the person can see.
    run = engine.run_status(
        engine.last_run(db, staff.tenant_id), now, settings["stale_after_hours"]
    )
    run["refresh_started"] = False
    if run["needs_refresh"] and settings["auto_refresh"] >= 1:
        # Serve the cards we have straight away and work out fresh ones after
        # the response. The job's lock stops several page loads piling up.
        background.add_task(_refresh_in_background, staff.tenant_id)
        run["refresh_started"] = True

    allowed_rules = rule_keys_for(audiences_for(staff))
    if not allowed_rules:
        return _empty_page(settings, reason="no_audience", run=run)

    # A card stops being shown once no rule has confirmed it for this long.
    # The delay stops a measurement sitting on a threshold from flickering.
    fresh_since = now - timedelta(days=settings["card_expiry_days"])

    conditions = [
        Insight.tenant_id == staff.tenant_id,
        Insight.rule_key.in_(allowed_rules),
        Insight.last_computed_at >= fresh_since,
    ]
    # Branch staff see their own branch plus company-wide cards. A central user
    # sees everything, or one branch if they ask for it.
    wanted_branch = staff.branch_id or branch_id
    if wanted_branch is not None:
        conditions.append(
            or_(Insight.branch_id.is_(None), Insight.branch_id == wanted_branch)
        )

    rows = list(db.execute(
        select(Insight).where(*conditions).order_by(Insight.importance.desc())
    ).scalars())

    feedback = _latest_feedback(db, staff.tenant_id, [r.fingerprint for r in rows])
    branch_lookup = _branch_lookup(db, staff.tenant_id)

    visible, hidden = [], []
    for row in rows:
        decision = feedback.get(row.fingerprint)
        until = _hidden_until(decision, settings["snooze_days"])
        card = _shape_card(row, now, decision, branch_lookup)
        (hidden if (until is not None and until > now) else visible).append(card)

    # An empty page means one of two quite different things, and the wording
    # the client sees should say which. Only worth a query when it is empty.
    not_enough_data, orders_seen = False, None
    if not visible:
        since = now - timedelta(days=int(settings["window_days"]))
        orders_seen = engine.orders_in_window(db, staff.tenant_id, since, now)
        not_enough_data = orders_seen < settings["min_orders_to_trust"]

    shown = int(limit or settings["cards_shown"])
    return {
        "generated_at": now.isoformat(),
        "window_days": int(settings["window_days"]),
        "not_enough_data": not_enough_data,
        "orders_in_window": orders_seen,
        "min_orders_to_trust": int(settings["min_orders_to_trust"]),
        "reason": None,
        "run": run,
        "cards": visible[:shown],
        "more": visible[shown:],
        "hidden": hidden if include_hidden else [],
        "counts": {
            "visible": len(visible),
            "shown": min(shown, len(visible)),
            "hidden": len(hidden),
        },
        "waiting_on": _waiting_on(db, staff, allowed_rules, settings, now),
    }


def _empty_page(settings: dict, reason: str, run: dict | None = None) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_days": int(settings["window_days"]),
        "not_enough_data": reason == "not_enough_data",
        "orders_in_window": None,
        "min_orders_to_trust": int(settings["min_orders_to_trust"]),
        "reason": reason,
        "run": run,
        "cards": [],
        "more": [],
        "hidden": [],
        "counts": {"visible": 0, "shown": 0, "hidden": 0},
        "waiting_on": [],
    }


def _branch_lookup(db: Session, tenant_id) -> dict:
    return dict(
        db.execute(select(Branch.id, Branch.name).where(Branch.tenant_id == tenant_id)).all()
    )


def _waiting_on(db: Session, staff: CurrentStaff, allowed_rules, settings, now) -> list[dict]:
    """One line per data source that is blocking a rule this person would
    otherwise see, so the page can explain its gaps instead of looking empty."""
    statuses = source_statuses(
        db, staff.tenant_id, window_days=int(settings["window_days"]), now=now
    )
    available = set(runnable_source_keys(statuses))

    blocked: dict[str, list[str]] = {}
    for key in allowed_rules:
        rule = RULES.get(key)
        if rule is None:
            continue
        for source in rule.requires:
            if source not in available:
                blocked.setdefault(source, []).append(rule.title)

    return [
        {
            "source": source,
            "label": statuses[source].label,
            "note": statuses[source].note,
            "state": statuses[source].state,
            "insights_waiting": titles,
        }
        for source, titles in sorted(blocked.items())
        if source in statuses
    ]


# ==========================================================================
# POST /insights/feedback
# ==========================================================================
class FeedbackIn(BaseModel):
    # fingerprint() returns exactly 32 characters, so anything else is wrong.
    fingerprint: str = Field(min_length=32, max_length=32)
    action: str
    note: str | None = Field(default=None, max_length=500)


@router.post("/feedback", status_code=201)
def leave_feedback(
    payload: FeedbackIn,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Record what somebody decided about a piece of advice.

    Always an insert, never an update, so the history survives: that is what
    makes "which advice gets acted on" answerable, and it means reopening a
    card later leaves a trail instead of overwriting the past.
    """
    if payload.action not in VALID_ACTIONS:
        raise HTTPException(
            status_code=422,
            detail=f"action must be one of {', '.join(VALID_ACTIONS)}",
        )

    # The card has to exist and be one this person is allowed to see, or a
    # fingerprint could be used to leave feedback on another client's data.
    allowed_rules = rule_keys_for(audiences_for(staff))
    insight = db.execute(
        select(Insight).where(
            Insight.tenant_id == staff.tenant_id,
            Insight.fingerprint == payload.fingerprint,
            Insight.rule_key.in_(allowed_rules),
        )
    ).scalar_one_or_none()
    if insight is None:
        raise HTTPException(status_code=404, detail="No such insight.")

    db.add(InsightFeedback(
        tenant_id=staff.tenant_id,
        fingerprint=payload.fingerprint,
        # Copied from the insight on purpose: it keeps meaning after the
        # insight row has been regenerated or deleted.
        rule_key=insight.rule_key,
        staff_id=staff.user_id,
        action=payload.action,
        note=payload.note,
    ))
    db.commit()
    return {"fingerprint": payload.fingerprint, "action": payload.action}


# ==========================================================================
# GET /insights/advice-taken
# ==========================================================================
@router.get("/advice-taken")
def advice_taken(
    days: int = Query(90, ge=7, le=365),
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Which kinds of advice get acted on, and which get dismissed.

    Counts every decision ever made, not just the latest per card, because the
    question is about behaviour over time rather than current state.
    """
    _central_only(staff)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = db.execute(
        select(
            InsightFeedback.rule_key,
            InsightFeedback.action,
            func.count(InsightFeedback.id).label("times"),
        )
        .where(
            InsightFeedback.tenant_id == staff.tenant_id,
            InsightFeedback.created_at >= since,
        )
        .group_by(InsightFeedback.rule_key, InsightFeedback.action)
    ).all()

    per_rule: dict[str, dict] = {}
    for rule_key, action, times in rows:
        entry = per_rule.setdefault(
            rule_key,
            {
                "rule_key": rule_key,
                "rule_title": RULES[rule_key].title if rule_key in RULES else rule_key,
                "done": 0, "not_useful": 0, "snoozed": 0, "total": 0,
            },
        )
        if action in entry:
            entry[action] += int(times)
        entry["total"] += int(times)

    for entry in per_rule.values():
        entry["acted_on_share"] = (
            round(entry["done"] / entry["total"], 3) if entry["total"] else None
        )

    items = sorted(per_rule.values(), key=lambda e: e["total"], reverse=True)
    return {"days": days, "items": items}


# ==========================================================================
# The Settings tab
# ==========================================================================
@router.get("/settings")
def read_insight_settings(
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Every threshold, with its label, help text, range and current value."""
    _central_only(staff)
    return {
        "groups": list(GROUPS),
        "settings": settings_for_tab(db, staff.tenant_id),
    }


class SettingsIn(BaseModel):
    values: dict[str, float]


@router.put("/settings")
def write_insight_settings(
    payload: SettingsIn,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Save changed thresholds.

    All of them or none: one commit at the end, so a form with one bad value
    leaves nothing half-applied.
    """
    _central_only(staff)
    if not payload.values:
        raise HTTPException(status_code=422, detail="No settings to save.")
    saved = {}
    try:
        for key, value in payload.values.items():
            saved[key] = set_setting(db, staff.tenant_id, key, value, staff.user_id)
    except UnknownSetting as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Unknown setting: {exc}") from exc
    except SettingOutOfRange as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    db.commit()
    return {
        "saved": saved,
        # The cards still show yesterday's numbers until the engine runs again.
        "note": "New thresholds apply the next time insights are worked out.",
    }


class ResetIn(BaseModel):
    key: str | None = Field(default=None, description="Leave out to reset every threshold.")


@router.post("/settings/reset")
def reset_insight_settings(
    payload: ResetIn,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Put one threshold, or all of them, back to the default."""
    _central_only(staff)
    keys = [payload.key] if payload.key else [d.key for d in CATALOGUE]
    try:
        defaults = {k: reset_setting(db, staff.tenant_id, k) for k in keys}
    except UnknownSetting as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=f"Unknown setting: {exc}") from exc
    db.commit()
    return {"reset": defaults}


# ==========================================================================
# POST /insights/refresh
# ==========================================================================
@router.post("/refresh")
def refresh_insights(
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Work the insights out now instead of waiting for tonight.

    Runs in the request, which is fine for testing and for a button a director
    presses occasionally. Eighteen rules with several queries each is not
    something to put on a page load: the nightly job is the normal path.
    """
    _central_only(staff)
    report = engine.run_for_tenant(db, staff.tenant_id, trigger=TRIGGER_MANUAL)
    return {
        "summary": report.summary(),
        "orders_in_window": report.orders_in_window,
        "not_enough_data": report.not_enough_data,
        "rules_run": report.rules_run,
        "rules_waiting": report.rules_skipped,
        "rules_failed": report.rules_failed,
        "created": report.created,
        "updated": report.updated,
        "expired": report.expired,
    }


# ==========================================================================
# GET /insights/runs -- was the overnight job actually working?
# ==========================================================================
@router.get("/runs")
def read_runs(
    limit: int = Query(20, ge=1, le=100),
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """The last few attempts, so somebody can see whether the nightly job is
    running and what it has been doing.

    A list where every `trigger` says "manual" or "fallback" means the
    scheduled job on the server is not working, however healthy the page looks.
    """
    _central_only(staff)
    rows = db.execute(
        select(InsightRun)
        .where(InsightRun.tenant_id == staff.tenant_id)
        .order_by(InsightRun.started_at.desc())
        .limit(limit)
    ).scalars()

    items = [
        {
            "started_at": row.started_at.isoformat(),
            "finished_at": row.finished_at.isoformat() if row.finished_at else None,
            "seconds": (
                round(row.duration_seconds, 1) if row.duration_seconds is not None else None
            ),
            "trigger": row.trigger,
            "ok": row.ok,
            "summary": row.summary,
            "rules_run": row.rules_run,
            "created": row.cards_created,
            "updated": row.cards_updated,
            "expired": row.cards_expired,
            "orders_in_window": row.orders_in_window,
            "not_enough_data": row.not_enough_data,
            "rules_waiting": row.rules_waiting,
            "rules_failed": row.rules_failed,
        }
        for row in rows
    ]
    nightly = [i for i in items if i["trigger"] == "nightly"]
    return {
        "items": items,
        # A plain answer to "is the scheduled job working?"
        "nightly_runs": len(nightly),
        "last_nightly_at": nightly[0]["started_at"] if nightly else None,
    }