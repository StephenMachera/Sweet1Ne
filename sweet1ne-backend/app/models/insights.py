import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


# How much data the rule had, relative to what it needs. A plain string, not a
# database enum: this is a presentation label, so changing it should never need
# a migration. (Order.status is a real enum because it is a fixed workflow.)
CONFIDENCE_EARLY = "early"
CONFIDENCE_FAIR = "fair"
CONFIDENCE_SOLID = "solid"


class Insight(Base):
    """One card, produced by one rule, about one subject.

    Rewritten by the nightly job, so this table is disposable: it can be
    emptied and rebuilt without losing anything a human decided. Those
    decisions live in insight_feedback, keyed by fingerprint.
    """

    __tablename__ = "insights"
    __table_args__ = (
        # One row per piece of advice. This is what makes the nightly upsert
        # safe: even a bug in the job cannot create two cards for one subject.
        UniqueConstraint("tenant_id", "fingerprint", name="uq_insights_tenant_fingerprint"),
        # The only query the page makes: this client's cards, recent ones only.
        # No separate index on tenant_id: a composite covers its leading column.
        Index("ix_insights_tenant_computed", "tenant_id", "last_computed_at"),
    )

    # --- Identity ---
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))

    # Empty means the card is about the whole company, not one branch.
    # CASCADE is right here, unlike on orders: a card is machine output with no
    # history worth keeping, so it should go when its branch does.
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("branches.id", ondelete="CASCADE"), nullable=True
    )

    # Which rule produced it, e.g. "dead_item". The rule's definition in code
    # holds its audiences and which order channels it covers.
    rule_key: Mapped[str] = mapped_column(String(40))

    # The stable identity of this advice: a hash of rule + scope + subject, and
    # deliberately NOT of any measurement. Same advice tomorrow -> same value,
    # so feedback given today still applies.
    fingerprint: Mapped[str] = mapped_column(String(32))

    # The readable version of what the card is about: "Lamb Pie", "Friday",
    # "vegan burger". The fingerprint is a hash, so this is how a human
    # reading the table can tell what a row concerns.
    subject_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # --- The rule's own words, numbers already filled in ---
    headline: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str] = mapped_column(String(800))
    suggestion: Mapped[str] = mapped_column(String(500))

    # The rephrased version: {"headline", "detail", "suggestion", "model",
    # "written_at"}. One column, because these are written, read and fall back
    # together and nothing ever filters on them. Empty means not rephrased, and
    # the page shows the rule's own words instead — which covers the AI being
    # off, down, slow, or simply not yet run.
    ai_text: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # --- The numbers behind the claim ---
    # Everything the card displays, and the only figures the AI is given.
    # e.g. {"weekday": "Friday", "window": "19:00-21:00", "share_percent": 31}
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict)

    importance: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[str] = mapped_column(String(10), default=CONFIDENCE_EARLY)
    # The period the rule looked at, so the card can say "over 30 days".
    window_days: Mapped[int] = mapped_column(Integer, default=30)

    # --- Timing ---
    # Set once, never updated: lets a card say "true for three weeks".
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Stamped on every run that confirms the pattern. When a rule stops firing
    # this stops moving, and the card drops off once it is older than the
    # card_expiry_days setting.
    last_computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())