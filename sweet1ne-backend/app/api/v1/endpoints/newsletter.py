from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.newsletter_subscriber import NewsletterSubscriber
from app.models.tenant import Tenant

router = APIRouter()


class SubscribeIn(BaseModel):
    email: EmailStr
    consented: bool


@router.post("/public/newsletter", status_code=204)
def subscribe(payload: SubscribeIn, db: Session = Depends(get_db)):
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
        # Someone re-subscribing after opting out.
        if not existing.is_subscribed:
            existing.is_subscribed = True
            existing.unsubscribed_at = None
            db.commit()
        return

    db.add(
        NewsletterSubscriber(tenant_id=tenant.id, email=email, source="website")
    )
    db.commit()