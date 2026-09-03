import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.reservation import Reservation
from app.models.staff import Staff
from app.models.tenant import Tenant
from app.schemas.reservation import (
    ReservationDecision,
    ReservationIn,
    ReservationOut,
    ReservationPublicOut,
)
from app.services.email.client import send_email
from app.services.email.templates import (
    reservation_confirmed,
    reservation_declined,
    reservation_received,
)

router = APIRouter()

VALID_TYPES = {"table", "private", "enquiry"}


def _to_out(db: Session, reservation: Reservation) -> ReservationOut:
    out = ReservationOut.model_validate(reservation)

    branch = db.get(Branch, reservation.branch_id)
    out.branch_name = branch.name if branch else None

    if reservation.handled_by_staff_id:
        staff = db.get(Staff, reservation.handled_by_staff_id)
        out.handled_by_name = staff.full_name if staff else None

    return out


# --- Public ------------------------------------------------------------


@router.post("/public/reservations", response_model=ReservationPublicOut)
async def create_reservation(
    payload: ReservationIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """A request, not a booking — nothing is confirmed until a manager says so."""
    if payload.reservation_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Unknown reservation type")

    is_enquiry = payload.reservation_type == "enquiry"

    # An enquiry has no party or date — it's a message, not a booking.
    if not is_enquiry:
        if payload.party_size < 1:
            raise HTTPException(status_code=400, detail="Party size must be at least one.")

        if payload.requested_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=400, detail="Please choose a date and time in the future."
            )

    if is_enquiry and not payload.notes:
        raise HTTPException(status_code=400, detail="Please tell us what you'd like to ask.")


    branch = db.get(Branch, payload.branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status_code=404, detail="Branch not found")

    reservation = Reservation(
        tenant_id=branch.tenant_id,
        branch_id=branch.id,
        name=payload.name.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip(),
        reservation_type=payload.reservation_type,
        party_size=payload.party_size,
        requested_at=payload.requested_at,
        occasion=payload.occasion,
        notes=payload.notes,
        marketing_consent=payload.marketing_consent,
        status="pending",
    )

    db.add(reservation)

    # Booking a table is not consent to be marketed to — only the separate
    # tick counts, and it's recorded with a timestamp so consent can be
    # demonstrated later.
    if payload.marketing_consent:
        existing = db.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.email == reservation.email
            )
        ).scalars().first()

        if existing is None:
            db.add(
                NewsletterSubscriber(
                    tenant_id=branch.tenant_id,
                    email=reservation.email,
                    source="reservation",
                )
            )

    db.commit()
    db.refresh(reservation)

    # Sent after the response, so a slow mail API doesn't hold up the form.
    subject, html = reservation_received.render(
        name=reservation.name,
        branch_name=branch.name,
        party_size=reservation.party_size,
        requested_at=reservation.requested_at,
        reservation_type=reservation.reservation_type,
    )
    background.add_task(
        send_email,
        to=reservation.email,
        subject=subject,
        html=html,
        reply_to=settings.EMAIL_REPLY_TO,
    )

    return ReservationPublicOut(
        id=reservation.id,
        status=reservation.status,
        branch_name=branch.name,
        requested_at=reservation.requested_at,
    )


# --- Staff -------------------------------------------------------------


@router.get("/reservations", response_model=list[ReservationOut])
def list_reservations(
    status: str | None = None,
    upcoming_only: bool = True,
    staff: CurrentStaff = Depends(require_permission("manage_reservations")),
    db: Session = Depends(get_db),
):
    statement = select(Reservation).where(Reservation.tenant_id == staff.tenant_id)

    if staff.branch_id is not None:
        statement = statement.where(Reservation.branch_id == staff.branch_id)

    if status:
        statement = statement.where(Reservation.status == status)

    if upcoming_only:
        today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
        # An enquiry has no date at all — "upcoming" doesn't apply to it, so
        # it should never be filtered out by this check.
        statement = statement.where(
            or_(Reservation.requested_at >= today_start, Reservation.requested_at.is_(None))
        )

    # Soonest first — the ones needing an answer are the ones happening next.
    reservations = db.execute(
        statement.order_by(Reservation.requested_at.asc())
    ).scalars().all()

    return [_to_out(db, r) for r in reservations]


@router.patch("/reservations/{reservation_id}", response_model=ReservationOut)
async def decide_reservation(
    reservation_id: uuid.UUID,
    payload: ReservationDecision,
    background: BackgroundTasks,
    staff: CurrentStaff = Depends(require_permission("manage_reservations")),
    db: Session = Depends(get_db),
):
    """Confirm or decline — either way the customer hears back."""
    if payload.status not in {"confirmed", "declined", "cancelled"}:
        raise HTTPException(status_code=400, detail="Unknown status")

    reservation = db.get(Reservation, reservation_id)
    if reservation is None or str(reservation.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if staff.branch_id is not None and str(reservation.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to handle this reservation")

    reservation.status = payload.status
    reservation.staff_message = payload.staff_message
    reservation.handled_by_staff_id = staff.user_id
    reservation.handled_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(reservation)

    branch = db.get(Branch, reservation.branch_id)
    branch_settings = branch.settings or {}

    # Both templates read as a table booking ("you're booked", "we can't do
    # that time") — that copy doesn't fit an enquiry, which has no date or
    # party size to confirm or decline in the first place.
    if reservation.reservation_type != "enquiry":
        if payload.status == "confirmed":
            subject, html = reservation_confirmed.render(
                name=reservation.name,
                branch_name=branch.name,
                branch_address=branch.address,
                branch_phone=branch.phone,
                party_size=reservation.party_size,
                requested_at=reservation.requested_at,
                staff_message=reservation.staff_message,
            )
            background.add_task(
                send_email,
                to=reservation.email,
                subject=subject,
                html=html,
                reply_to=settings.EMAIL_REPLY_TO,
            )

        elif payload.status == "declined":
            subject, html = reservation_declined.render(
                name=reservation.name,
                branch_name=branch.name,
                branch_phone=branch.phone,
                requested_at=reservation.requested_at,
                staff_message=reservation.staff_message,
            )
            background.add_task(
                send_email,
                to=reservation.email,
                subject=subject,
                html=html,
                reply_to=settings.EMAIL_REPLY_TO,
            )

    return _to_out(db, reservation)