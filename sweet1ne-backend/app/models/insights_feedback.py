import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


ACTION_DONE = "done"              # acted on it; hide the card
ACTION_NOT_USEFUL = "not_useful"  # bad advice; hide the card
ACTION_SNOOZED = "snoozed"        # hide it for snooze_days, then show again


class InsightFeedback(Base):
    """What a person decided about a piece of advice.

    Points at the fingerprint, not at an insight row, so a decision survives
    the nightly job rewriting the insights table.

    Nothing here is ever updated or deleted: each decision is a new row. So the
    current state of a card is its most recent row, and the whole history stays
    for "which advice actually gets acted on".
    """

    __tablename__ = "insight_feedback"
    __table_args__ = (
        # "the latest decision about this fingerprint" — the query the page runs
        # for every card.
        Index("ix_insight_feedback_tenant_fp", "tenant_id", "fingerprint", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)

    fingerprint: Mapped[str] = mapped_column(String(32))
    # Repeated from the insight on purpose: it lets you report by rule without
    # joining, and it still means something after the insight row is gone.
    rule_key: Mapped[str] = mapped_column(String(40))

    # Nullable so a system action (an automatic expiry, say) can be recorded.
    staff_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())