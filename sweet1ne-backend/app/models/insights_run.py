import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# What set a run going. Worth recording: a run that only ever happens because
# somebody opened the page means the nightly job is not working.
TRIGGER_NIGHTLY = "nightly"      # the scheduled job on the server
TRIGGER_MANUAL = "manual"        # somebody pressed the button
TRIGGER_FALLBACK = "fallback"    # the page found the insights stale and kicked one off


class InsightRun(Base):
    """One attempt at working out the insights for one client.

    This exists so a failure is visible instead of silent. Without it, a
    nightly job that quietly stops would show up weeks later as a page that
    has gone empty, with nothing to explain why.

    The row is created and committed BEFORE the work starts, so a crash still
    leaves evidence: a row with no finished_at means a run began and never
    came back.
    """

    __tablename__ = "insight_runs"
    __table_args__ = (
        # "the latest run for this client", which is the only question asked.
        Index("ix_insight_runs_tenant_started", "tenant_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Empty means still going, or stopped so badly it never wrote back.
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    trigger: Mapped[str] = mapped_column(String(20), default=TRIGGER_MANUAL)
    # False until the run finishes with no rule failures.
    ok: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    summary: Mapped[str | None] = mapped_column(String(300), nullable=True)
    rules_run: Mapped[int] = mapped_column(Integer, default=0)
    cards_created: Mapped[int] = mapped_column(Integer, default=0)
    cards_updated: Mapped[int] = mapped_column(Integer, default=0)
    cards_expired: Mapped[int] = mapped_column(Integer, default=0)

    orders_in_window: Mapped[int] = mapped_column(Integer, default=0)
    not_enough_data: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # {rule_key: reason}. Waiting is normal (a source is not connected yet);
    # failing is a bug somebody needs to see.
    rules_waiting: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rules_failed: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    @property
    def duration_seconds(self) -> float | None:
        if self.finished_at is None:
            return None
        return (self.finished_at - self.started_at).total_seconds()