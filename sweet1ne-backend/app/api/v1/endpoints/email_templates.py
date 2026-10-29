import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db, Session
from app.core.security import require_permission, CurrentStaff
from app.schemas.email_template import (
    EmailTemplateOut,
    EmailTemplateIn,
    EmailTemplateTestSendIn,
)
from app.models.campigns import EmailTemplate
from app.services.email.campaign_renderer import render_campaign
from app.services.email.client import send_email

router = APIRouter()

@router.get("", response_model=list[EmailTemplateOut])
def list_email_templates(staff=Depends(require_permission("manage_marketing")), db=Depends(get_db)):
    return db.execute(select(EmailTemplate).where(EmailTemplate.tenant_id == staff.tenant_id)).scalars().all()


@router.post("", response_model=EmailTemplateOut)
def create_email_template(
    payload: EmailTemplateIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    template = EmailTemplate(tenant_id=staff.tenant_id, **payload.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


# Registered before /{template_id} so "test-send" isn't swallowed as a
# template id — FastAPI matches routes in declaration order. Stateless,
# like /campaigns/preview: sends whatever's currently in the composer,
# saved or not, rather than requiring the template to exist in the
# database first — unlike a campaign, a template never has to be "the
# record of what went out", so there's nothing to load from a row here.
@router.post("/test-send", status_code=202)
def test_send_email_template(
    payload: EmailTemplateTestSendIn,
    background_tasks: BackgroundTasks,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
):
    html = render_campaign(
        subject=payload.subject,
        preheader=payload.preheader,
        blocks=payload.blocks,
        recipient_email=payload.email,
        site_url=settings.FRONTEND_URL,
        background=payload.background,
        background_animated=payload.background_animated,
    )
    background_tasks.add_task(
        send_email,
        to=payload.email,
        subject=f"[Test] {payload.subject}",
        html=html,
        reply_to=settings.EMAIL_REPLY_TO,
    )


@router.patch("/{template_id}", response_model=EmailTemplateOut)
def update_email_template(
    template_id: uuid.UUID,
    payload: EmailTemplateIn,
    staff: CurrentStaff = Depends(require_permission("manage_marketing")),
    db: Session = Depends(get_db),
):
    template = db.get(EmailTemplate, template_id)
    if template is None or str(template.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")

    for field, value in payload.model_dump().items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


