import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Numeric, Date, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
date = datetime.now().date()
if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from  app.models.role import Role


class Staff(Base):
    __tablename__ = "staff"

    # --- Identifiers ---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL")
    )
    role_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("roles.id", ondelete="SET NULL")
    )

    # --- Personal ---
    full_name: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    picture_url: Mapped[str | None] = mapped_column(String)
    date_of_birth: Mapped[datetime | None] = mapped_column(Date)
    address: Mapped[str | None] = mapped_column(String)

    # --- Emergency contact ---
    emergency_contact_name: Mapped[str | None] = mapped_column(String)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String)

    # --- Employment ---
    employment_type: Mapped[str | None] = mapped_column(String)  # full_time | part_time | casual | zero_hours
    national_insurance_number: Mapped[str | None] = mapped_column(String)
    right_to_work_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    shift_pattern: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String)

    # --- Pay ---
    salary: Mapped[float | None] = mapped_column(Numeric(10, 2))
    pay_type: Mapped[str | None] = mapped_column(String)  # hourly | annual
    hire_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #--- System ---
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # --- Relationships ---
    tenant: Mapped["Tenant"] = relationship(back_populates="staff")
    role: Mapped["Role"] = relationship(foreign_keys=[role_id])

    @property
    def is_director(self) -> bool:
        return self.branch_id is None