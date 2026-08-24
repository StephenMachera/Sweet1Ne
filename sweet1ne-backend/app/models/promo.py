import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class Promo(Base):
    __tablename__ = "promos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # NULL = every branch. Set = one branch only.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE")
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)

    # --- What it targets ---
    # item | category | order
    target_type: Mapped[str] = mapped_column(String, nullable=False, server_default="item")
    target_menu_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id", ondelete="CASCADE")
    )
    target_main_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("main_categories.id", ondelete="CASCADE")
    )

    # --- What it does ---
    # percentage | fixed_price
    discount_type: Mapped[str] = mapped_column(String, nullable=False, server_default="percentage")
    discount_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    fixed_price: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # --- When ---
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="promos")