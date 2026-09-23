import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Promotion(Base):
    """A scheduled message placed across guest-facing surfaces (homepage
    after Enter, the quiet header ribbon, the table phone, a Marketing
    letter) plus optional paid-tile preview copy for Google/Meta/Instagram.

    Distinct from Promo (app/models/promo.py), which is the existing
    per-item/category price-discount engine already used to compute
    MenuItem.promo_price — that stays untouched. A "code" kind promotion
    here can additionally take a flat percent/pounds off the whole basket,
    which Promo has never supported (item/category only).
    """

    __tablename__ = "promotions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # NULL = both branches. Set = one branch only.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE")
    )

    # notice | invite | mail | code
    kind: Mapped[str] = mapped_column(String, nullable=False, server_default="notice")

    title: Mapped[str] = mapped_column(String, nullable=False)
    kicker: Mapped[str | None] = mapped_column(String)
    dek: Mapped[str | None] = mapped_column(String)

    # book | find | menu | events | contact | order | join
    cta: Mapped[str] = mapped_column(String, nullable=False, server_default="book")
    cta_label: Mapped[str | None] = mapped_column(String)

    # Only meaningful when kind == "code". A live code-kind promotion whose
    # surfaces.phone is on gets applied automatically to the guest's basket
    # on the table phone — the guest never types anything.
    code: Mapped[str | None] = mapped_column(String)
    # none (the code is the offer, no maths) | percent | pounds
    offer: Mapped[str] = mapped_column(String, nullable=False, server_default="none")
    off: Mapped[float | None] = mapped_column(Numeric(10, 2))

    starts_at: Mapped[date] = mapped_column(Date, nullable=False)
    ends_at: Mapped[date | None] = mapped_column(Date)

    is_on: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # all (anyone on that surface) | quiet (away N+ days) | regular (N+ visits)
    who: Mapped[str] = mapped_column(String, nullable=False, server_default="all")
    quiet_days: Mapped[int] = mapped_column(Integer, server_default="50")
    regular_visits: Mapped[int] = mapped_column(Integer, server_default="4")

    # {enter, ribbon, phone, mail} -> bool
    surfaces: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    # Unused — the paid-tile preview (Google/Meta/Instagram) was removed
    # from the UI. Column kept rather than migrated away, since it's inert.
    channels: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    # The composer's block list — same shape family as Event/Campaign layouts.
    layout: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    # {still: left|top|none, tone: glass|solid, align: left|center}
    look: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")

    # UTM campaign id, shared with a Marketing campaign via "Open in
    # Marketing" — free-text tag, not a foreign key.
    map_id: Mapped[str | None] = mapped_column(String)

    created_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
