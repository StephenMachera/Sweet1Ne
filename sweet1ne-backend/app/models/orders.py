import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.table import Table
    from app.models.order_item import OrderItem


class OrderStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    ready = "ready"


class Order(Base):
    __tablename__ = "orders"

    #--- Indifiers---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tables.id", ondelete="CASCADE"), nullable=False
    )
    placed_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL")
    )

    #--- Order Details ---
    seat_number: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status", native_enum=True),
        default=OrderStatus.pending,
        server_default=OrderStatus.pending.value,
        nullable=False,
    )
    special_request: Mapped[str | None] = mapped_column(String)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    
    #--- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    #--- Relationships ---
    table: Mapped["Table"] = relationship(back_populates="orders")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    #---methods---
    @property
    def table_number(self) -> int | None:
        return self.table.number if self.table else None

    @property
    def branch_id(self) -> uuid.UUID | None:
        return self.table.branch_id if self.table else None

    @property
    def branch_name(self) -> str | None:
        return self.table.branch.name if self.table and self.table.branch else None
