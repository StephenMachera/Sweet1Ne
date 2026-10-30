import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db

from app.models.campigns import Campaign
from app.models.campaign_recipient import CampaignRecipient
from app.models.event_email import EmailEvent

router = APIRouter()

CR = CampaignRecipient


def _central_only(staff: CurrentStaff) -> None:
    """Campaigns are sent centrally, so their results are central too."""
    if staff.branch_id is not None:
        raise HTTPException(
            status_code=403,
            detail="Campaign analytics are available centrally rather than per branch.",
        )


def _rate(part: int, whole: int) -> float | None:
    """A percentage with one decimal, or None when there's nothing to divide by."""
    return round(100 * part / whole, 1) if whole else None


def _agg_columns() -> list:
    """The counting columns, reused by every endpoint."""
    return [
        func.count().label("attempted"),
        func.count().filter(CR.status != "failed").label("sent"),
        func.count().filter(CR.status == "failed").label("failed"),
        func.count(CR.delivered_at).label("delivered"),
        func.count(CR.first_opened_at).label("opened"),
        func.count(CR.first_clicked_at).label("clicked"),
        func.count(CR.bounced_at).label("bounced"),
        func.count(CR.complained_at).label("complained"),
        func.coalesce(func.sum(CR.open_count), 0).label("total_opens"),
        func.coalesce(func.sum(CR.click_count), 0).label("total_clicks"),
    ]


def _summary(r) -> dict:
    return {
        "attempted": r.attempted,
        "sent": r.sent,
        "failed": r.failed,
        "delivered": r.delivered,
        "opened": r.opened,            # people who opened at least once
        "clicked": r.clicked,          # people who clicked at least once
        "bounced": r.bounced,
        "complained": r.complained,
        "total_opens": int(r.total_opens),
        "total_clicks": int(r.total_clicks),
        "delivery_rate": _rate(r.delivered, r.sent),
        "open_rate": _rate(r.opened, r.delivered),
        "click_rate": _rate(r.clicked, r.delivered),
        "bounce_rate": _rate(r.bounced, r.sent),
    }


# ---------------------------------------------------------------- 1. overview
@router.get("/overview")
def overview(
    days: int = Query(30, ge=1, le=365),
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    _central_only(staff)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    row = db.execute(
        select(*_agg_columns(), func.count(distinct(CR.campaign_id)).label("campaigns"))
        .where(CR.tenant_id == staff.tenant_id, CR.sent_at >= since)
    ).one()
    return {"days": days, "campaigns": row.campaigns, **_summary(row)}


# ------------------------------------------------------- 2. campaigns list
@router.get("/campaigns")
def campaigns(
    days: int = Query(90, ge=1, le=365),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    _central_only(staff)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = (CR.tenant_id == staff.tenant_id, CR.sent_at >= since)

    total = db.execute(
        select(func.count(distinct(CR.campaign_id))).where(*base)
    ).scalar_one()

    rows = db.execute(
        select(
            Campaign.id,
            Campaign.name,
            Campaign.subject,
            Campaign.audience,
            Campaign.sent_at,
            *_agg_columns(),
        )
        .join(Campaign, Campaign.id == CR.campaign_id)
        .where(*base)
        .group_by(
            Campaign.id,
            Campaign.name,
            Campaign.subject,
            Campaign.audience,
            Campaign.sent_at,
        )
        .order_by(Campaign.sent_at.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [
            {
                "campaign_id": str(r.id),
                "name": r.name,
                "subject": r.subject,
                "audience": r.audience,
                "sent_at": r.sent_at,
                **_summary(r),
            }
            for r in rows
        ],
    }


# -------------------------------------------------------- 3. one campaign
@router.get("/campaigns/{campaign_id}")
def campaign_detail(
    campaign_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    _central_only(staff)
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    mine = (CR.tenant_id == staff.tenant_id, CR.campaign_id == campaign_id)

    row = db.execute(select(*_agg_columns()).where(*mine)).one()
    summary = _summary(row)

    # Top clicked links: how many clicks, and how many different people.
    links = db.execute(
        select(
            EmailEvent.link,
            func.count().label("clicks"),
            func.count(distinct(EmailEvent.resend_email_id)).label("people"),
        )
        .join(CR, CR.resend_email_id == EmailEvent.resend_email_id)
        .where(*mine, EmailEvent.event_type == "email.clicked", EmailEvent.link.is_not(None))
        .group_by(EmailEvent.link)
        .order_by(func.count().desc())
        .limit(10)
    ).all()

    # Opens and clicks per day (days are UTC).
    day = func.date_trunc("day", EmailEvent.occurred_at).label("day")
    timeline = db.execute(
        select(
            day,
            func.count().filter(EmailEvent.event_type == "email.opened").label("opens"),
            func.count().filter(EmailEvent.event_type == "email.clicked").label("clicks"),
        )
        .join(CR, CR.resend_email_id == EmailEvent.resend_email_id)
        .where(*mine, EmailEvent.event_type.in_(["email.opened", "email.clicked"]))
        .group_by(day)
        .order_by(day)
    ).all()

    return {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "subject": campaign.subject,
        "audience": campaign.audience,
        "status": campaign.status,
        "sent_at": campaign.sent_at,
        **summary,
        "funnel": [
            {"step": "Sent", "count": summary["sent"]},
            {"step": "Delivered", "count": summary["delivered"]},
            {"step": "Opened", "count": summary["opened"]},
            {"step": "Clicked", "count": summary["clicked"]},
        ],
        "top_links": [
            {"link": l.link, "clicks": l.clicks, "people": l.people} for l in links
        ],
        "timeline": [
            {"day": t.day, "opens": t.opens, "clicks": t.clicks} for t in timeline
        ],
    }


# ------------------------------------------------------------ 4. the people
RECIPIENT_FILTERS = {
    "delivered": CR.delivered_at.is_not(None),
    "opened": CR.first_opened_at.is_not(None),
    "clicked": CR.first_clicked_at.is_not(None),
    "bounced": CR.bounced_at.is_not(None),
    "complained": CR.complained_at.is_not(None),
    "failed": CR.status == "failed",
}


@router.get("/campaigns/{campaign_id}/recipients")
def campaign_recipients(
    campaign_id: uuid.UUID,
    status: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    _central_only(staff)
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or str(campaign.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Campaign not found")

    conditions = [CR.tenant_id == staff.tenant_id, CR.campaign_id == campaign_id]

    if status:
        if status not in RECIPIENT_FILTERS:
            raise HTTPException(status_code=400, detail="Unknown status filter")
        conditions.append(RECIPIENT_FILTERS[status])
    if search:
        conditions.append(CR.email.ilike(f"%{search.strip()}%"))

    total = db.execute(select(func.count()).select_from(CR).where(*conditions)).scalar_one()
    rows = db.execute(
        select(CR)
        .where(*conditions)
        .order_by(CR.sent_at.desc(), CR.email)
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [
            {
                "email": r.email,
                "status": r.status,
                "sent_at": r.sent_at,
                "delivered_at": r.delivered_at,
                "first_opened_at": r.first_opened_at,
                "first_clicked_at": r.first_clicked_at,
                "bounced_at": r.bounced_at,
                "complained_at": r.complained_at,
                "open_count": r.open_count,
                "click_count": r.click_count,
            }
            for r in rows
        ],
    }
