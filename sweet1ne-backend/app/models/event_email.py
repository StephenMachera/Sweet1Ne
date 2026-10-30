import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmailEvent(Base):
    """A raw log of every Resend webhook delivery — one row per
    delivered/opened/clicked/bounced/complained event, kept even for
    addresses that don't match a campaign_recipients row (e.g. a
    reservation email, which still goes through Resend but isn't part of
    any campaign). svix_id is unique so a webhook retry doesn't get
    logged twice."""
    __tablename__ = "email_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    svix_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    resend_email_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    # email.sent | email.delivered | email.opened | email.clicked |
    # email.bounced | email.complained — whatever Resend sends.
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    # Only set on a click event — which link was clicked.
    link: Mapped[str | None] = mapped_column(String)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # The full webhook payload, kept verbatim in case something beyond the
    # columns above is ever needed without a schema change.
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
