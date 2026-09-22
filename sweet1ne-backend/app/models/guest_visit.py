import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GuestVisit(Base):
    """Tracks a returning, anonymous guest at one branch so a promotion can
    target "quiet" (away a while) or "regular" (comes often) guests for
    real. `guest_id` is a random ID the guest's browser generates itself and
    keeps in localStorage — no login, no PII, nothing tying it to a real
    identity. Starts empty for everyone; only fills in from real visits.
    """

    __tablename__ = "guest_visits"
    __table_args__ = (UniqueConstraint("tenant_id", "branch_id", "guest_id", name="uq_guest_visit"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    branch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False
    )
    guest_id: Mapped[str] = mapped_column(String, nullable=False)

    visit_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
