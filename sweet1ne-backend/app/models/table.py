import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.orders import Order


class Table(Base):
    __tablename__ = "tables"
    __table_args__ = (
        UniqueConstraint("branch_id", "number", name="uq_table_branch_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )

    region: Mapped[str | None] = mapped_column(String)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)

    # The non-guessable value actually encoded in the QR code's URL — not
    # the human-facing `number`, so a scanned URL can't be used to guess
    # at other tables just by changing a digit.
    qr_token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    # URL to the generated QR image, once a service function creates it and
    # uploads it to Supabase Storage — same pattern as MenuItem.picture.
    qr_code_url: Mapped[str | None] = mapped_column(String)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    branch: Mapped["Branch"] = relationship(back_populates="tables")
    orders: Mapped[list["Order"]] = relationship(back_populates="table", cascade="all, delete-orphan")