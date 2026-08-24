from datetime import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, func, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.orders import Order
    from app.models.menu_item import MenuItem


class OrderItem(Base):
    __tablename__ = "order_items"
    #---indentifiers---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    menu_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("menu_items.id"), nullable=False
    )

    #---fields---
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String, default="pending", server_default="pending"
    )

    #---timestamps---
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    #---relationships---
    order: Mapped["Order"] = relationship(back_populates="order_items")
    menu_item: Mapped["MenuItem"] = relationship()

    @property
    def menu_item_title(self) -> str | None:
        return self.menu_item.title if self.menu_item else None