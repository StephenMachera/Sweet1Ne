import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import CurrentStaff, require_permission

from app.db.session import get_db

from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.tenant import Tenant

from app.services.email.client import send_email
from app.services.email.templates import newsletter_welcome

from app.schemas.newsletter import SubscribeIn, SubscriberOut, SubscriberStats

router = APIRouter()





# --- Public ------------------------------------------------------------


@router.post("/public/newsletter", status_code=204)
async def subscribe(
    payload: SubscribeIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not payload.consented:
        raise HTTPException(status_code=400, detail="Consent is required.")

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
        db.add(NewsletterSubscriber(tenant_id=tenant.id, email=email, source="website"))
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

    return [
        SubscriberOut(
            id=str(r.id),
            email=r.email,
            source=r.source,
            is_subscribed=r.is_subscribed,
            consented_at=r.consented_at,
            unsubscribed_at=r.unsubscribed_at,
        )
        for r in rows
    ]


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