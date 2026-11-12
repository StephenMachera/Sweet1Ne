# app/models/insight_setting.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InsightSetting(Base):
    """One row per threshold the client has changed from its default.
    Anything not stored here falls back to the default in the catalogue."""

    __tablename__ = "insight_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_insight_settings_tenant_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)   # ADJUST to match your other models

    key: Mapped[str] = mapped_column(String(60))      # e.g. "sales_change_min_percent"
    value: Mapped[float] = mapped_column(Float)

    # Who last changed it, for the audit line on the Settings tab.
    updated_by_staff_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )