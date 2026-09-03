import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.event import Event
from app.models.tenant import Tenant
from app.schemas.event import EventIn, EventOut, EventUpdate

router = APIRouter()


def _to_out(db: Session, event: Event) -> EventOut:
    out = EventOut.model_validate(event)
    if event.branch_id:
        branch = db.get(Branch, event.branch_id)
        out.branch_name = branch.name if branch else None
    return out


# --- Public ------------------------------------------------------------


@router.get("/public/events", response_model=list[EventOut])
def public_events(db: Session = Depends(get_db)):
    """Upcoming published events, soonest first."""
    tenant = db.execute(select(Tenant)).scalars().first()
    if tenant is None:
        return []

    now = datetime.now(timezone.utc)

    events = db.execute(
        select(Event)
        .where(
            Event.tenant_id == tenant.id,
            Event.is_published == True,
            # An event that has started but not ended is still on.
            or_(Event.ends_at >= now, Event.starts_at >= now),
        )
        .order_by(Event.starts_at.asc())
    ).scalars().all()

    return [_to_out(db, e) for e in events]


@router.get("/public/events/next", response_model=EventOut | None)
def next_event(db: Session = Depends(get_db)):
    """The one the popup announces — soonest featured event, or nothing."""
    tenant = db.execute(select(Tenant)).scalars().first()
    if tenant is None:
        return None

    now = datetime.now(timezone.utc)

    event = db.execute(
        select(Event)
        .where(
            Event.tenant_id == tenant.id,
            Event.is_published == True,
            Event.is_featured == True,
            or_(Event.ends_at >= now, Event.starts_at >= now),
        )
        .order_by(Event.starts_at.asc())
    ).scalars().first()

    return _to_out(db, event) if event else None


@router.get("/public/events/{slug}", response_model=EventOut)
def public_event(slug: str, db: Session = Depends(get_db)):
    event = db.execute(
        select(Event).where(Event.slug == slug, Event.is_published == True)
    ).scalars().first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    return _to_out(db, event)


# --- Staff -------------------------------------------------------------


@router.get("/events", response_model=list[EventOut])
def list_events(
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    """Every event, published or not — including past ones, since a manager
    may want to duplicate or review them."""
    statement = select(Event).where(Event.tenant_id == staff.tenant_id)

    if staff.branch_id is not None:
        statement = statement.where(
            or_(Event.branch_id == staff.branch_id, Event.branch_id.is_(None))
        )

    events = db.execute(statement.order_by(Event.starts_at.desc())).scalars().all()
    return [_to_out(db, e) for e in events]


@router.post("/events", response_model=EventOut)
def create_event(
    payload: EventIn,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    existing = db.execute(select(Event).where(Event.slug == payload.slug)).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="An event with that link already exists.")

    # A branch manager's own branch always wins; only a director chooses,
    # and NULL means every branch.
    if staff.branch_id is not None:
        branch_id = staff.branch_id
    else:
        branch_id = payload.branch_id
        if branch_id is not None:
            branch = db.get(Branch, branch_id)
            if branch is None or str(branch.tenant_id) != staff.tenant_id:
                raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.model_dump(exclude={"branch_id"})
    event = Event(**data, tenant_id=staff.tenant_id, branch_id=branch_id)

    db.add(event)
    db.commit()
    db.refresh(event)
    return _to_out(db, event)


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: uuid.UUID,
    payload: EventUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if event is None or str(event.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if staff.branch_id is not None and str(event.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this event")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return _to_out(db, event)


@router.delete("/events/{event_id}", status_code=204)
def unpublish_event(
    event_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_promotions")),
    db: Session = Depends(get_db),
):
    """Unpublishes rather than deletes — an event that's been shared has a
    URL people may still hold."""
    event = db.get(Event, event_id)
    if event is None or str(event.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if staff.branch_id is not None and str(event.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to remove this event")

    event.is_published = False
    db.commit()