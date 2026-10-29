import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    # Shown in most inboxes beside the subject — worth having, easy to forget.
    preheader: Mapped[str | None] = mapped_column(String)

    # The blocks, in order. JSONB rather than a table because they're only
    # ever read and written as a whole, and the shape will change as block
    # types are added.
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    # The whole email's own page color, from the editor's color picker —
    # None keeps the default dark Sweet1NE look. See _resolve_palette in
    # campaign_renderer.py for how one hex becomes a full palette.
    background: Mapped[str | None] = mapped_column(String)
    # Turns that same background into a slow shimmering gradient instead
    # of a flat fill — meaningless without a background set, see
    # _animated_background_style in campaign_renderer.py.
    background_animated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # draft | sending | sent | failed
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="draft")

    # active (all subscribed) | website | qr | booking — filters the
    # subscriber list by NewsletterSubscriber.source at send time.
    audience: Mapped[str] = mapped_column(String, nullable=False, server_default="active")
    # Which ad platforms this same promotion also ran on — informational,
    # shown next to the campaign, not acted on by the backend.
    channels: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    # UTM campaign id, shared with the matching promotion/event if there is
    # one — purely for the marketer's own tagging, not read anywhere else.
    map_id: Mapped[str | None] = mapped_column(String)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_count: Mapped[int] = mapped_column(Integer, server_default="0")
    failed_count: Mapped[int] = mapped_column(Integer, server_default="0")

    created_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False, server_default="")
    subject: Mapped[str] = mapped_column(String, nullable=False)
    preheader: Mapped[str | None] = mapped_column(String)
    blocks: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, server_default="[]")
    # Same page-color override as Campaign.background — carried over onto
    # the new campaign when a template is used to start one.
    background: Mapped[str | None] = mapped_column(String)
    background_animated: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
        )
