import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.campaign_recipient import CampaignRecipient    
from app.models.event_email import EmailEvent            
from app.models.guest_activity import GuestActivity            
from app.models.guest_session import GuestSession              
from app.services.insights.registry import (
    SOURCE_ACTIVITY, SOURCE_EMAIL, SOURCE_ORDERS, SOURCE_QR_VISITS,
    SOURCE_RESERVATIONS, SOURCE_SUBSCRIBERS, SOURCE_TAKEAWAY, SOURCES,
)


# --------------------------------------------------------------------------
# The three states
# --------------------------------------------------------------------------
STATE_CONNECTED = "connected"          # wired up, and data arrived recently
STATE_QUIET = "quiet"                  # wired up once, nothing lately
STATE_NOT_CONNECTED = "not_connected"  # never wired up

# A rule may run if its sources have ever worked. Rules stay silent on their
# own when there is too little data, so there is nothing to gain from
# blocking a quiet source.
RUNNABLE_STATES = (STATE_CONNECTED, STATE_QUIET)


@dataclass(frozen=True)
class SourceStatus:
    key: str
    label: str                      # what the page calls it
    state: str
    last_seen_at: datetime | None
    note: str                       # one plain line for the page

    @property
    def is_runnable(self) -> bool:
        return self.state in RUNNABLE_STATES


# --------------------------------------------------------------------------
# The decision, with no database in sight so it can be tested directly
# --------------------------------------------------------------------------
def _state_from(last_seen_at: datetime | None, now: datetime, window_days: int) -> str:
    if last_seen_at is None:
        return STATE_NOT_CONNECTED
    if last_seen_at >= now - timedelta(days=window_days):
        return STATE_CONNECTED
    return STATE_QUIET


def _note_for(key: str, label: str, state: str, last_seen_at: datetime | None) -> str:
    if state == STATE_CONNECTED:
        return f"{label} is connected."
    if state == STATE_QUIET:
        seen = last_seen_at.date().isoformat() if last_seen_at else "a while ago"
        return f"{label} is connected, but nothing has arrived since {seen}."
    return _NOT_CONNECTED_NOTES.get(key, f"{label} is not connected yet.")


_NOT_CONNECTED_NOTES = {
    SOURCE_QR_VISITS: "Insights about guests will appear once people start scanning the QR menu.",
    SOURCE_ACTIVITY: "Insights about pages, searches and taps need the website and QR menu tracking to be live.",
    SOURCE_EMAIL: "Email insights will appear once the Resend webhook is connected and a campaign has been sent.",
    SOURCE_TAKEAWAY: "Takeaway insights will appear once that service is connected.",
    SOURCE_RESERVATIONS: "Reservation insights will appear once the booking service is connected.",
}

LABELS = {
    SOURCE_ORDERS: "Orders",
    SOURCE_SUBSCRIBERS: "Newsletter signups",
    SOURCE_QR_VISITS: "QR menu visits",
    SOURCE_ACTIVITY: "Page and menu activity",
    SOURCE_EMAIL: "Email campaign tracking",
    SOURCE_TAKEAWAY: "Takeaway service",
    SOURCE_RESERVATIONS: "Reservation service",
}

# Your own tables, always available. If they are empty, the rules' own
# minimums take care of it.
ALWAYS_ON = (SOURCE_ORDERS, SOURCE_SUBSCRIBERS)

# Nothing to probe until an adapter exists.
AWAITING_ADAPTER = (SOURCE_TAKEAWAY, SOURCE_RESERVATIONS)


# --------------------------------------------------------------------------
# One probe per source: the newest timestamp for this client, or None
# --------------------------------------------------------------------------
def _last_qr_visit(db: Session, tenant_id: uuid.UUID) -> datetime | None:
    return db.execute(
        select(func.max(GuestSession.started_at)).where(GuestSession.tenant_id == tenant_id)
    ).scalar_one_or_none()


def _last_activity(db: Session, tenant_id: uuid.UUID) -> datetime | None:
    return db.execute(
        select(func.max(GuestActivity.occurred_at)).where(GuestActivity.tenant_id == tenant_id)
    ).scalar_one_or_none()


def _last_email_event(db: Session, tenant_id: uuid.UUID) -> datetime | None:
    # EmailEvent carries no tenant_id of its own: it is keyed by the Resend
    # email id, so the client comes from the recipient it belongs to.
    return db.execute(
        select(func.max(EmailEvent.occurred_at))
        .join(CampaignRecipient, CampaignRecipient.resend_email_id == EmailEvent.resend_email_id)
        .where(CampaignRecipient.tenant_id == tenant_id)
    ).scalar_one_or_none()


PROBES: dict[str, Callable[[Session, uuid.UUID], datetime | None]] = {
    SOURCE_QR_VISITS: _last_qr_visit,
    SOURCE_ACTIVITY: _last_activity,
    SOURCE_EMAIL: _last_email_event,
}


# --------------------------------------------------------------------------
# What the engine and the page call
# --------------------------------------------------------------------------
def source_statuses(
    db: Session,
    tenant_id: uuid.UUID,
    window_days: int = 30,
    now: datetime | None = None,
) -> dict[str, SourceStatus]:
    """Every source, with its state and a line the page can show."""
    now = now or datetime.now(timezone.utc)
    out: dict[str, SourceStatus] = {}

    for key in SOURCES:
        label = LABELS.get(key, key)

        if key in ALWAYS_ON:
            state, last_seen = STATE_CONNECTED, None
        elif key in AWAITING_ADAPTER:
            state, last_seen = STATE_NOT_CONNECTED, None
        else:
            probe = PROBES.get(key)
            if probe is None:
                # A source with no probe and no entry above: treat it as
                # missing rather than quietly assuming it works.
                state, last_seen = STATE_NOT_CONNECTED, None
            else:
                last_seen = probe(db, tenant_id)
                state = _state_from(last_seen, now, window_days)

        out[key] = SourceStatus(
            key=key, label=label, state=state, last_seen_at=last_seen,
            note=_note_for(key, label, state, last_seen),
        )
    return out


def runnable_source_keys(statuses: dict[str, SourceStatus]) -> list[str]:
    """The sources a rule is allowed to depend on."""
    return [k for k, s in statuses.items() if s.is_runnable]


def missing_notes(statuses: dict[str, SourceStatus], required_by_rules) -> list[str]:
    """One line per source that is blocking at least one rule, so the page can
    explain the gaps instead of showing nothing."""
    needed = set()
    for sources in required_by_rules:
        needed.update(sources)
    return [
        s.note for k, s in statuses.items()
        if k in needed and s.state == STATE_NOT_CONNECTED
    ]