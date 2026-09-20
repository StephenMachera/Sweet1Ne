import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Media(Base):
    """The shared library menu items, events and (later) campaigns pick
    photos, GIFs and films from. Only ever queried by tenant_id, the same
    standalone-resource shape as Campaign — no back_populates needed on
    Tenant."""

    __tablename__ = "media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    label: Mapped[str] = mapped_column(String, nullable=False)
    # still | gif | video
    kind: Mapped[str] = mapped_column(String, nullable=False, server_default="still")
    # The uploaded file itself, in Supabase Storage.
    src: Mapped[str] = mapped_column(String, nullable=False)
    # Videos only — a still frame uploaded alongside, since there's no
    # video-processing step here to generate one automatically.
    poster: Mapped[str | None] = mapped_column(String)
    alt: Mapped[str | None] = mapped_column(String)

    # House branding assets, seeded rather than staff-added — not
    # removable from the library. Nothing is seeded yet; this exists so a
    # future seed script has somewhere to mark rows as protected.
    locked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
