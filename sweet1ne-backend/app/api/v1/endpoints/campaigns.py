import asyncio
import uuid
from datetime import datetime, timezone


from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import CurrentStaff, require_permission
from app.db.session import SessionLocal, get_db

from app.models.campigns import Campaign
from app.models.newsletter_subscriber import NewsletterSubscriber

from app.services.email.campaign_renderer import render_campaign
from app.services.email.client import send_email

from app.schemas.campaign import CampaignIn, CampaignOut, PreviewOut, TestSendIn

router = APIRouter()

# A small pause between sends. Not fast, but it keeps well clear of rate
# limits and spreads the load — which matters more than speed when the same
# domain also sends booking confirmations.
SEND_DELAY_SECONDS = 0.12



@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    return db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == staff.tenant_id)
        .order_by(Campaign.updated_at.desc())
    ).scalars().all()


@router.post("", response_model=CampaignOut)
def create_campaign(
    payload: CampaignIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaigns are sent centrally rather than per branch.",
        )
    campaign = Campaign(
        tenant_id=staff.tenant_id,
        created_by_staff_id=staff.user_id,
        **payload.model_dump(),
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(
    campaign_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: uuid.UUID,
    payload: CampaignIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaigns are sent centrally rather than per branch.",
        )
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # A sent campaign is a record of what went out — editing it would make
    # that record a lie.
    if campaign.status in {"sent", "sending"}:
        raise HTTPException(
            status_code=400, detail="This campaign has already been sent."
        )

    for field, value in payload.model_dump().items():
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/duplicate", response_model=CampaignOut)
def duplicate_campaign(
    campaign_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    """Templates by the back door — last Christmas's campaign becomes this
    year's starting point."""
    original = db.get(Campaign, campaign_id)
    if original is None or str(original.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaigns are sent centrally rather than per branch.",
        )

    copy = Campaign(
        tenant_id=staff.tenant_id,
        created_by_staff_id=staff.user_id,
        name=f"{original.name} (copy)",
        subject=original.subject,
        preheader=original.preheader,
        blocks=original.blocks,
        status="draft",
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return copy


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(
    campaign_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)
    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaigns are sent centrally rather than per branch.",
        )
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status == "sent":
        raise HTTPException(
            status_code=400, detail="Sent campaigns are kept as a record."
        )

    db.delete(campaign)
    db.commit()


@router.post("/preview", response_model=PreviewOut)
def preview_campaign(
    payload: CampaignIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
):
    """Renders without saving, so the editor can show a live preview."""
    return PreviewOut(
        html=render_campaign(
            subject=payload.subject,
            preheader=payload.preheader,
            blocks=payload.blocks,
            recipient_email="preview@example.com",
            site_url=settings.FRONTEND_URL,
        )
    )


@router.post("/{campaign_id}/test", status_code=202)
async def send_test(
    campaign_id: uuid.UUID,
    payload: TestSendIn,
    background: BackgroundTasks,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    html = render_campaign(
        subject=campaign.subject,
        preheader=campaign.preheader,
        blocks=campaign.blocks,
        recipient_email=payload.email,
        site_url=settings.FRONTEND_URL,
    )

    background.add_task(
        send_email,
        to=payload.email,
        subject=f"[Test] {campaign.subject}",
        html=html,
        reply_to=settings.EMAIL_REPLY_TO,
    )


async def _send_to_list(campaign_id: uuid.UUID, tenant_id: uuid.UUID) -> None:
    """Sends the campaign, one recipient at a time.

    Runs on its own session because the request's session is closed by the
    time this executes. Each recipient gets their own render, since the
    unsubscribe link is personal to them.
    """
    db = SessionLocal()
    try:
        campaign = db.get(Campaign, campaign_id)
        if campaign is None:
            return

        subscribers = db.execute(
            select(NewsletterSubscriber).where(
                NewsletterSubscriber.tenant_id == tenant_id,
                NewsletterSubscriber.is_subscribed == True,
            )
        ).scalars().all()

        sent = 0
        failed = 0

        for subscriber in subscribers:
            html = render_campaign(
                subject=campaign.subject,
                preheader=campaign.preheader,
                blocks=campaign.blocks,
                recipient_email=subscriber.email,
                site_url=settings.FRONTEND_URL,
            )

            ok = await send_email(
                to=subscriber.email,
                subject=campaign.subject,
                html=html,
                reply_to=settings.EMAIL_REPLY_TO,
            )

            if ok:
                sent += 1
            else:
                failed += 1

            await asyncio.sleep(SEND_DELAY_SECONDS)

        campaign.status = "sent" if sent else "failed"
        campaign.sent_at = datetime.now(timezone.utc)
        campaign.sent_count = sent
        campaign.failed_count = failed
        db.commit()
    finally:
        db.close()


@router.post("/{campaign_id}/send", response_model=CampaignOut)
def send_campaign(
    campaign_id: uuid.UUID,
    background: BackgroundTasks,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)
    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaigns are sent centrally rather than per branch.",
        )
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail="This campaign has already been sent.")

    if not campaign.blocks:
        raise HTTPException(status_code=400, detail="There's nothing in this campaign yet.")

    recipients = db.execute(
        select(NewsletterSubscriber).where(
            NewsletterSubscriber.tenant_id == staff.tenant_id,
            NewsletterSubscriber.is_subscribed == True,
        )
    ).scalars().all()

    if not recipients:
        raise HTTPException(status_code=400, detail="Nobody is subscribed yet.")

    # Marked before the work starts, so a second click can't send it twice.
    campaign.status = "sending"
    db.commit()
    db.refresh(campaign)

    background.add_task(_send_to_list, campaign.id, staff.tenant_id)

    return campaign