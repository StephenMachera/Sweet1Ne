import hashlib
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.services.insights.settings import SETTINGS_BY_KEY


# --------------------------------------------------------------------------
# Who sees a card
# --------------------------------------------------------------------------
AUDIENCE_DIRECTOR = "director"
AUDIENCE_MANAGER = "manager"
AUDIENCE_MARKETING = "marketing"
AUDIENCES = (AUDIENCE_DIRECTOR, AUDIENCE_MANAGER, AUDIENCE_MARKETING)


# --------------------------------------------------------------------------
# The data a rule can depend on. The engine skips a rule whose sources are
# not connected, so the page can say "will appear once connected" instead of
# showing a confident zero.
# --------------------------------------------------------------------------
SOURCE_ORDERS = "orders"            # your own orders: always available
SOURCE_QR_VISITS = "qr_visits"      # guest_sessions
SOURCE_ACTIVITY = "activity"        # guest_activity: page views, searches, taps
SOURCE_EMAIL = "email"              # campaign recipients and email events
SOURCE_SUBSCRIBERS = "subscribers"  # newsletter signups
SOURCE_TAKEAWAY = "takeaway"        # external service, not connected yet
SOURCE_RESERVATIONS = "reservations"  # SevenRooms, not connected yet
SOURCES = (SOURCE_ORDERS, SOURCE_QR_VISITS, SOURCE_ACTIVITY, SOURCE_EMAIL,
           SOURCE_SUBSCRIBERS, SOURCE_TAKEAWAY, SOURCE_RESERVATIONS)

ALL_ORDER_SOURCES = ("*",)          # the rule covers every order channel


# --------------------------------------------------------------------------
# What a rule hands back
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Card:
    """One finding. Not a database row yet: the engine scores it, rephrases it
    and saves it."""

    # What makes this advice unique: the dish, the weekday, the search term.
    # NEVER a measurement -- "21 days" here would make a new card every night.
    subject_parts: tuple
    # The readable version of the above, for the card and for reading the table.
    subject_label: str | None

    headline: str
    detail: str
    suggestion: str
    # Every figure the card shows, and the only figures the AI is given.
    evidence: dict

    # 0..1, the rule's own view of how much this matters. The rule does NOT
    # apply confidence or recency: the engine does that the same way for all
    # rules, or the ranking would not be comparable.
    impact: float
    # How many observations backed the finding, and the minimum the rule
    # wanted. The engine turns the ratio into early / fair / solid.
    data_points: int
    data_needed: int

    # Which branch, or None for a company-wide card.
    branch_id: uuid.UUID | None = None

    def __post_init__(self):
        if not 0.0 <= self.impact <= 1.0:
            raise ValueError(f"impact must be 0..1, got {self.impact}")
        if not self.subject_parts:
            raise ValueError("subject_parts must not be empty")
        if self.data_needed <= 0:
            raise ValueError("data_needed must be positive")


# --------------------------------------------------------------------------
# What a rule receives
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Context:
    db: Session
    tenant_id: uuid.UUID
    # Every branch of this client. A rule decides for itself whether to loop
    # over them, compare them, or ignore them.
    branch_ids: tuple[uuid.UUID, ...]
    # All 34 thresholds, defaults already merged in.
    settings: dict[str, float]
    now: datetime
    since: datetime         # start of the window
    prev_since: datetime    # start of the window before it, for comparisons
    london: ZoneInfo

    def setting(self, key: str) -> float:
        """Read a threshold. Raises if the key is not in the catalogue, so a
        typo fails loudly instead of silently reading nothing."""
        if key not in SETTINGS_BY_KEY:
            raise KeyError(f"unknown setting {key!r}")
        return self.settings[key]


# --------------------------------------------------------------------------
# A rule, and the registry
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Rule:
    key: str
    title: str
    audiences: tuple[str, ...]
    requires: tuple[str, ...]
    order_sources: tuple[str, ...]
    settings: tuple[str, ...]
    run: Callable[[Context], list[Card]]
    decays: bool = True  # whether the engine applies recency and confidence

    def covers_all_order_sources(self) -> bool:
        return "*" in self.order_sources


RULES: dict[str, Rule] = {}


def rule(
    *,                                  # everything must be passed by name
    key: str,
    title: str,
    audiences: tuple[str, ...],
    requires: tuple[str, ...] = (SOURCE_ORDERS,),
    order_sources: tuple[str, ...] = ALL_ORDER_SOURCES,
    settings: tuple[str, ...] = (),
    decays: bool = True,
):
    """Register one rule. Every check here runs at IMPORT time, so a mistake
    stops the app starting rather than breaking the nightly job."""

    def register(fn: Callable[[Context], list[Card]]):
        if key in RULES:
            raise ValueError(f"duplicate rule key {key!r}")

        bad_audiences = [a for a in audiences if a not in AUDIENCES]
        if bad_audiences:
            raise ValueError(f"rule {key!r}: unknown audiences {bad_audiences}")
        if not audiences:
            raise ValueError(f"rule {key!r}: no audience, so nobody would ever see it")

        bad_sources = [s for s in requires if s not in SOURCES]
        if bad_sources:
            raise ValueError(f"rule {key!r}: unknown data sources {bad_sources}")

        unknown = [s for s in settings if s not in SETTINGS_BY_KEY]
        if unknown:
            raise ValueError(f"rule {key!r}: settings not in the catalogue: {unknown}")

        RULES[key] = Rule(
            key=key, title=title, audiences=audiences, requires=requires,
            order_sources=order_sources, settings=settings, run=fn, decays=decays,
        )
        return fn

    return register


# --------------------------------------------------------------------------
# Helpers the engine and the endpoints use
# --------------------------------------------------------------------------
def fingerprint(rule_key: str, branch_id, *subject_parts) -> str:
    """The stable identity of one piece of advice.

    Built from the rule, the scope and the subject -- never from a
    measurement. Same advice tomorrow gives the same value, so feedback given
    today still applies.
    """
    text = "|".join(str(p) for p in (rule_key, branch_id or "all", *subject_parts))
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def rule_keys_for(audiences) -> list[str]:
    """Which rules a person with these audiences is allowed to see. This is
    why the insights table needs no audience column."""
    wanted = set(audiences)
    return sorted(k for k, r in RULES.items() if wanted & set(r.audiences))


def runnable_rules(connected_sources) -> list[Rule]:
    """The rules whose data sources are all connected."""
    available = set(connected_sources)
    return [r for r in RULES.values() if available.issuperset(r.requires)]


def blocked_rules(connected_sources) -> list[Rule]:
    """The rules that cannot run yet, so the page can say what is missing
    rather than showing nothing."""
    available = set(connected_sources)
    return [r for r in RULES.values() if not available.issuperset(r.requires)]