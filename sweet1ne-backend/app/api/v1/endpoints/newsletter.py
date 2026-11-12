import csv
import io
import uuid
from datetime import datetime, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import CurrentStaff, require_permission

from app.db.session import get_db

from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.tenant import Tenant

from app.services.email.client import send_email
from app.services.lead_import import MAX_FILE_BYTES, ImportFileError, parse_leads
from app.services.email.templates import newsletter_welcome

from app.schemas.newsletter import (
    SubscribeIn,
    SubscriberCreateIn,
    SubscriberCreateOut,
    SubscriberOut,
    SubscriberStats,
    SubscriberToggleIn,
)

router = APIRouter()


def _subscriber_out(r: NewsletterSubscriber) -> SubscriberOut:
    return SubscriberOut(
        id=str(r.id),
        email=r.email,
        source=r.source,
        is_subscribed=r.is_subscribed,
        consented_at=r.consented_at,
        unsubscribed_at=r.unsubscribed_at,
        is_read=r.is_read,
    )





# --- Public ------------------------------------------------------------


@router.post("/public/newsletter", status_code=204)
async def subscribe(
    payload: SubscribeIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not payload.consented:
        raise HTTPException(status_code=400, detail="Consent is required.")

    # SubscribeIn.email (EmailStr) only checks the format — Pydantic
    # explicitly disables the deliverability check email_validator would
    # otherwise do. Running it ourselves catches a domain that can't
    # actually receive mail (typo'd, made-up, or long dead) before it ever
    # reaches the subscriber list.
    try:
        validate_email(payload.email, check_deliverability=True)
    except EmailNotValidError:
        raise HTTPException(
            status_code=400,
            detail="That email address doesn't look like it can receive mail — mind double-checking it?",
        )

    tenant = db.execute(select(Tenant)).scalars().first()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Not available")

    email = payload.email.strip().lower()

    existing = db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
    ).scalars().first()

    if existing:
        # Already on the list — don't send a second welcome. Someone
        # re-subscribing after opting out does get one.
        if existing.is_subscribed:
            return

        existing.is_subscribed = True
        existing.unsubscribed_at = None
        existing.consented_at = datetime.now(timezone.utc)
        db.commit()
    else:
        db.add(NewsletterSubscriber(tenant_id=tenant.id, email=email, source=payload.source))
        db.commit()

    subject, html = newsletter_welcome.render(email=email)
    background.add_task(
        send_email, to=email, subject=subject, html=html, reply_to=settings.EMAIL_REPLY_TO
    )


@router.get("/public/unsubscribe", status_code=204)
def unsubscribe(email: str, db: Session = Depends(get_db)):
    """Reached from the link in every marketing email. One click, no login —
    making someone sign in to leave isn't lawful consent management."""
    subscriber = db.execute(
        select(NewsletterSubscriber).where(
            NewsletterSubscriber.email == email.strip().lower()
        )
    ).scalars().first()

    if subscriber and subscriber.is_subscribed:
        subscriber.is_subscribed = False
        subscriber.unsubscribed_at = datetime.now(timezone.utc)
        db.commit()


# --- Staff -------------------------------------------------------------


@router.get("/newsletter/subscribers", response_model=list[SubscriberOut])
def list_subscribers(
    subscribed_only: bool = True,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    statement = select(NewsletterSubscriber).where(
        NewsletterSubscriber.tenant_id == staff.tenant_id
    )

    if subscribed_only:
        statement = statement.where(NewsletterSubscriber.is_subscribed == True)

    rows = db.execute(
        statement.order_by(NewsletterSubscriber.consented_at.desc())
    ).scalars().all()

    return [_subscriber_out(r) for r in rows]


@router.post("/newsletter/subscribers/mark-read", status_code=204)
def mark_subscribers_read(
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """Drives the sidebar's "new leads" badge. There's no per-row detail to
    open here (unlike Inbox/Orders), so viewing the Leads list is itself
    what marks everything on it as seen — called once when that page
    loads."""
    db.execute(
        update(NewsletterSubscriber)
        .where(NewsletterSubscriber.tenant_id == staff.tenant_id, NewsletterSubscriber.is_read == False)
        .values(is_read=True)
    )
    db.commit()


@router.post("/newsletter/subscribers", response_model=SubscriberCreateOut)
def create_subscriber(
    payload: SubscriberCreateIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """Manual add, and what a CSV import calls once per row — email is
    unique across the whole table, so an existing address is updated
    (added/updated/skipped, same distinction the CSV importer needs) rather
    than rejected."""
    email = payload.email.strip().lower()

    existing = db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)
    ).scalars().first()

    if existing:
        if str(existing.tenant_id) != staff.tenant_id:
            raise HTTPException(status_code=409, detail="That email is already on another company's list.")
        existing.source = payload.source
        if payload.consented and not existing.is_subscribed:
            existing.is_subscribed = True
            existing.unsubscribed_at = None
            existing.consented_at = payload.consented_at or datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return SubscriberCreateOut(subscriber=_subscriber_out(existing), created=False)

    subscriber = NewsletterSubscriber(
        tenant_id=staff.tenant_id,
        email=email,
        source=payload.source,
        is_subscribed=payload.consented,
    )
    if payload.consented_at:
        subscriber.consented_at = payload.consented_at
    db.add(subscriber)
    db.commit()
    db.refresh(subscriber)
    return SubscriberCreateOut(subscriber=_subscriber_out(subscriber), created=True)


@router.post("/newsletter/import")
def import_subscribers(
    file: UploadFile = File(...),
    source: str = Form("import"),
    consented: bool = Form(False),
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """Bulk import from an Excel or CSV file. Everyone in it is saved with
    the source label given here (a "source" column in the file wins for that
    row). Anyone not marked as having agreed is stored but not mailed. People
    already on the list are left exactly as they are, so an unsubscribe is
    never undone by a spreadsheet."""
    content = file.file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="That file is over 10 MB.")

    try:
        rows, unreadable, truncated = parse_leads(file.filename or "", content)
    except ImportFileError as err:
        raise HTTPException(status_code=400, detail=str(err))

    batch_source = source.strip()[:60] or "import"
    unique: dict[str, tuple[str, bool]] = {}
    for row in rows:
        label = row.source or batch_source
        if row.location:
            label = f"{label} · {row.location}"
        unique.setdefault(
            row.email,
            (label[:60], consented if row.consented is None else row.consented),
        )
    duplicates_in_file = len(rows) - len(unique)

    existing: dict[str, str] = {}
    emails = list(unique)
    for i in range(0, len(emails), 500):
        chunk = emails[i : i + 500]
        for email, tenant_id in db.execute(
            select(func.lower(NewsletterSubscriber.email), NewsletterSubscriber.tenant_id).where(
                func.lower(NewsletterSubscriber.email).in_(chunk)
            )
        ):
            existing[email] = str(tenant_id)

    now = datetime.now(timezone.utc)
    added = mailable = already_there = other_company = 0
    for email, (row_source, agreed) in unique.items():
        if email in existing:
            if existing[email] == str(staff.tenant_id):
                already_there += 1
            else:
                other_company += 1
            continue
        db.add(
            NewsletterSubscriber(
                tenant_id=staff.tenant_id,
                email=email,
                source=row_source,
                is_subscribed=agreed,
                consented_at=now,
                is_read=True,
            )
        )
        added += 1
        mailable += 1 if agreed else 0

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Someone added some of these at the same time. Try the import again.")

    return {
        "added": added,
        "mailable": mailable,
        "not_mailable": added - mailable,
        "already_there": already_there,
        "other_company": other_company,
        "unreadable": unreadable,
        "duplicates_in_file": duplicates_in_file,
        "truncated": truncated,
        "source": batch_source,
    }


@router.patch("/newsletter/subscribers/{subscriber_id}", response_model=SubscriberOut)
def toggle_subscriber(
    subscriber_id: uuid.UUID,
    payload: SubscriberToggleIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    subscriber = db.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or str(subscriber.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Not found")

    subscriber.is_subscribed = payload.is_subscribed
    if payload.is_subscribed:
        subscriber.unsubscribed_at = None
    else:
        subscriber.unsubscribed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(subscriber)
    return _subscriber_out(subscriber)


@router.delete("/newsletter/subscribers/{subscriber_id}", status_code=204)
def delete_subscriber(
    subscriber_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """A real removal, not opting out — nothing else references a
    subscriber by id (campaigns match by source/email at send time, not a
    stored foreign key), so there's no order or send history at risk here,
    unlike deleting a branch or a menu item."""
    subscriber = db.get(NewsletterSubscriber, subscriber_id)
    if subscriber is None or str(subscriber.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(subscriber)
    db.commit()


@router.get("/newsletter/stats", response_model=SubscriberStats)
def subscriber_stats(
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    base = select(func.count()).select_from(NewsletterSubscriber).where(
        NewsletterSubscriber.tenant_id == staff.tenant_id
    )

    def count(*conditions):
        return db.execute(base.where(*conditions) if conditions else base).scalar() or 0

    return SubscriberStats(
        total=count(),
        subscribed=count(NewsletterSubscriber.is_subscribed == True),
        unsubscribed=count(NewsletterSubscriber.is_subscribed == False),
        from_website=count(NewsletterSubscriber.source == "website"),
        from_reservations=count(NewsletterSubscriber.source == "reservation"),
        from_table=count(NewsletterSubscriber.source == "qr"),
    )


@router.get("/newsletter/export")
def export_subscribers(
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """CSV of the active list, for importing into whatever actually sends the
    campaigns. The consent timestamp goes with it — under UK GDPR you have to
    be able to show when and how someone agreed."""
    rows = db.execute(
        select(NewsletterSubscriber).where(
            NewsletterSubscriber.tenant_id == staff.tenant_id,
            NewsletterSubscriber.is_subscribed == True,
        ).order_by(NewsletterSubscriber.consented_at.desc())
    ).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["email", "source", "consented_at"])

    for row in rows:
        writer.writerow([row.email, row.source, row.consented_at.isoformat()])

    buffer.seek(0)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="sweet1ne-subscribers-{stamp}.csv"'
        },
    )