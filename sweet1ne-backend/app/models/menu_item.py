import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.sub_menu_category import SubCategory
    from app.models.order_item import OrderItem


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    sub_category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_categories.id", ondelete="CASCADE"), nullable=False
    )

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    # Menu order is editorial (most expensive to least, not alphabetical) —
    # same convention as MainCategory.sort_order, just never had a column of
    # its own until a real pack needed its exact order preserved.
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    picture: Mapped[str | None] = mapped_column(String)
    # Up to 5, from the media library. `picture` above always mirrors
    # pictures[0] (or None) so every existing single-photo reader — kitchen
    # previews, the QR "needs a picture" count, the dashboard stat — keeps
    # working unchanged; this is the real, ordered set for the guest
    # phone's carousel.
    pictures: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    
    dietary_tags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    allergen_tags: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")

    sub_category: Mapped["SubCategory"] = relationship(back_populates="menu_items")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="menu_item")