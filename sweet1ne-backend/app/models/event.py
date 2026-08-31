import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # NULL = happening at every branch.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE")
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    # Used in the URL — /events/sax-and-mood-brunch
    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    tagline: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)

    image_url: Mapped[str | None] = mapped_column(String)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Free text rather than a number — "£25 per person", "Free entry",
    # "Booking required" are all things a venue wants to say here.
    price_note: Mapped[str | None] = mapped_column(String)

    # Whether this one gets the popup on the public site. Only the soonest
    # featured event shows, so several can be flagged without competing.
    is_featured: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="events")