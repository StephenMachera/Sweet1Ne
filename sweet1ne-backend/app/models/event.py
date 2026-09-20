import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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

    # The event's cover photo. Kept in sync with the layout's hero image
    # block on save (see `layout` below), so anything that only knows this
    # old single-image shape — the public popup, the events list — keeps
    # working without changes.
    image_url: Mapped[str | None] = mapped_column(String)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Free text rather than a number — "£25 per person", "Free entry",
    # "Booking required" are all things a venue wants to say here.
    price_note: Mapped[str | None] = mapped_column(String)

    # The composer's blocks, in order — same JSONB-not-a-table reasoning as
    # Campaign.blocks: this is only ever read and written as a whole, and
    # the set of block types will grow. Recognised `type`s today: logo,
    # kicker, meta, title, dek, image, note, ctas. kicker/meta/title/dek
    # are pure show/hide toggles for the matching column below (title,
    # starts_at/ends_at/branch, title, description); image/note/logo carry
    # their own content; ctas toggles the `ctas` list below. Unicode
    # (emoji included) needs no special handling — JSONB and Postgres text
    # columns are UTF-8 already.
    layout: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")

    # [{kind, label, href}, ...] — the buttons under the copy when a "ctas"
    # block is present in the layout. `kind` is a frontend-defined preset
    # ("book", "menu", "order") or "url" for a one-off link; the backend
    # doesn't constrain it, matching how layout block types aren't enforced
    # here either — see the comment above.
    ctas: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")

    # Whether this one gets the popup on the public site. Only the soonest
    # featured event shows, so several can be flagged without competing.
    is_featured: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="events")