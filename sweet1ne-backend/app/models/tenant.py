import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.branch import Branch
    from app.models.staff import Staff
    from app.models.main_menu_category import MainCategory
    from app.models.role import Role
    from app.models.promo import Promo

class Tenant(Base):
    __tablename__ = "tenants"

    # --- Basic information ---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # --- Contact & business information ---
    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    address: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    country: Mapped[str | None] = mapped_column(String)
    currency: Mapped[str] = mapped_column(String, default="USD", server_default="USD")
    timezone: Mapped[str] = mapped_column(String, default="America/New_York", server_default="America/New_York")

    # --- Branding & customization ---
    logo_url: Mapped[str | None] = mapped_column(String)
    primary_color: Mapped[str | None] = mapped_column(String)
    secondary_color: Mapped[str | None] = mapped_column(String)
    favicon_url: Mapped[str | None] = mapped_column(String)
    tagline: Mapped[str | None] = mapped_column(String)

    # --- Flexible settings ---
    # Director-level, company-wide toggles that don't need their own column/migration.
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")

    branches: Mapped[list["Branch"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    staff: Mapped[list["Staff"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    main_categories: Mapped[list["MainCategory"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    roles: Mapped[list["Role"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    promos: Mapped[list["Promo"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")