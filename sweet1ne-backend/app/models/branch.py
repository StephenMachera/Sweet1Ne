import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.table import Table
    from app.models.analytic_events import AnalyticsEvent
class Branch(Base):
    __tablename__ = "branches"

    # --- Basic information ---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # --- Contact & location ---
    phone: Mapped[str | None] = mapped_column(String)
    address: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    country: Mapped[str | None] = mapped_column(String)

    # --- Operating details (optional, structured) ---
    capacity: Mapped[int | None] = mapped_column(Integer)

    # --- Flexible settings ---
    # opening/closing hours, theme/color overrides, whether QR ordering is
    # enabled at this branch, local tax rate override, promo banner text —
    # anything branch-specific that shouldn't need its own migration.
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    tenant: Mapped["Tenant"] = relationship(back_populates="branches")
    tables: Mapped[list["Table"]] = relationship(back_populates="branch", cascade="all, delete-orphan")
    analytics_events: Mapped[list["AnalyticsEvent"]] = relationship(back_populates="branch", cascade="all, delete-orphan")