import uuid
from sqlalchemy.orm import mapped_column
from sqlalchemy import String,DateTime,ForeignKey,Integer
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    campaign_id = mapped_column(UUID(as_uuid=True), ForeignKey("campaigns.id"), index=True)
    subscriber_id = mapped_column(UUID(as_uuid=True), ForeignKey("newsletter_subscribers.id"), nullable=True)
    email = mapped_column(String, nullable=False)
    resend_email_id = mapped_column(String, unique=True, index=True, nullable=True)
    status = mapped_column(String, nullable=False)          
    sent_at = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at     = mapped_column(DateTime(timezone=True), nullable=True)
    first_opened_at  = mapped_column(DateTime(timezone=True), nullable=True)
    first_clicked_at = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at       = mapped_column(DateTime(timezone=True), nullable=True)
    complained_at    = mapped_column(DateTime(timezone=True), nullable=True)
    open_count       = mapped_column(Integer, nullable=False, default=0, server_default="0")
    click_count      = mapped_column(Integer, nullable=False, default=0, server_default="0")