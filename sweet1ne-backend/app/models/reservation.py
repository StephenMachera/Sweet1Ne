import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.tenant import Tenant


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    # Which branch they want. Required — a reservation has to be somewhere.
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )

    # --- Who ---
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)

    # --- What ---
    # table | private — a birthday for six and a whole-room hire are the same
    # journey until the form diverges.
    reservation_type: Mapped[str] = mapped_column(
        String, nullable=False, server_default="table"
    )
    party_size: Mapped[int] = mapped_column(Integer, nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    occasion: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)

    # --- Progress ---
    # pending | confirmed | declined | cancelled
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="pending")
    # What a manager wants the customer to know when confirming or declining.
    staff_message: Mapped[str | None] = mapped_column(Text)
    handled_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("staff.id", ondelete="SET NULL")
    )
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Whether they ticked the marketing box alongside the booking. Consent
    # for a reservation is not consent to be marketed to.
    marketing_consent: Mapped[bool] = mapped_column(
        default=False, server_default="false"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship(back_populates="reservations")