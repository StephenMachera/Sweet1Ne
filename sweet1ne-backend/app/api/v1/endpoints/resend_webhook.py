import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.campaign_recipient import CampaignRecipient
from app.models.event_email import EmailEvent

router = APIRouter()

# How far a recipient's status is allowed to move. It only ever goes up.
# "bounced" and "complained" are final, so they always win.
STATUS_RANK = {"failed": 0, "sent": 1, "delivered": 2, "opened": 3, "clicked": 4}
FINAL_STATUSES = {"bounced", "complained"}


def _signature_is_valid(secret: str, body: bytes, headers) -> bool:
    """Check Resend's (Svix) webhook signature."""
    if not secret:  # never accept anything if no secret is set
        return False

    msg_id = headers.get("svix-id")
    timestamp = headers.get("svix-timestamp")
    signatures = headers.get("svix-signature")
    if not (msg_id and timestamp and signatures):
        return False

    try:
        # Reject old messages, so a captured request can't be replayed later.
        if abs(time.time() - int(timestamp)) > 300:
            return False
        key = base64.b64decode(secret.removeprefix("whsec_"))
    except Exception:
        return False

    signed_content = f"{msg_id}.{timestamp}.".encode() + body
    expected = base64.b64encode(
        hmac.new(key, signed_content, hashlib.sha256).digest()
    ).decode()

    # The header can hold several signatures, like "v1,abc v1,def".
    for part in signatures.split(" "):
        version, _, signature = part.partition(",")
        if version == "v1" and hmac.compare_digest(signature, expected):
            return True
    return False


def _advance(recipient: CampaignRecipient, new_status: str) -> None:
    """Move the status forward, never backward."""
    if recipient.status in FINAL_STATUSES:
        return
    if new_status in FINAL_STATUSES:
        recipient.status = new_status
        return
    if STATUS_RANK.get(new_status, 0) > STATUS_RANK.get(recipient.status, 0):
        recipient.status = new_status


def _parse_time(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


@router.post("/webhooks/resend")
async def resend_webhook(request: Request, db: Session = Depends(get_db)):
    # 1. Verify the signature, using the RAW body (not parsed JSON).
    raw_body = await request.body()
    if not _signature_is_valid(settings.RESEND_WEBHOOK_SECRET, raw_body, request.headers):
        raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(raw_body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid body")

    svix_id = request.headers["svix-id"]
    event_type = event.get("type", "")
    data = event.get("data") or {}
    email_id = data.get("email_id")
    occurred_at = _parse_time(event.get("created_at"))

    # Not about a specific email: nothing to do, but tell Resend "ok".
    if not email_id:
        return {"status": "ignored"}

    # 2. Log the event. The unique svix_id catches retries.
    click = data.get("click") or {}
    db.add(
        EmailEvent(
            svix_id=svix_id,
            resend_email_id=email_id,
            event_type=event_type,
            link=click.get("link"),
            occurred_at=occurred_at,
            payload=event,
        )
    )
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate"}

    # 3. Find the recipient row (it may not exist, e.g. a reservation email).
    recipient = db.execute(
        select(CampaignRecipient).where(CampaignRecipient.resend_email_id == email_id)
    ).scalar_one_or_none()

    # 4. Update it.
    if recipient is not None:
        if event_type == "email.delivered":
            recipient.delivered_at = recipient.delivered_at or occurred_at
            _advance(recipient, "delivered")

        elif event_type == "email.opened":
            recipient.open_count += 1
            recipient.first_opened_at = recipient.first_opened_at or occurred_at
            _advance(recipient, "opened")

        elif event_type == "email.clicked":
            recipient.click_count += 1
            recipient.first_clicked_at = recipient.first_clicked_at or occurred_at
            _advance(recipient, "clicked")

        elif event_type == "email.bounced":
            recipient.bounced_at = recipient.bounced_at or occurred_at
            _advance(recipient, "bounced")

        elif event_type == "email.complained":
            recipient.complained_at = recipient.complained_at or occurred_at
            _advance(recipient, "complained")

    # 5. Save the event and the recipient update together.
    db.commit()
    return {"status": "ok"}