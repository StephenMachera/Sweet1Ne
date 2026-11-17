from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.insight_settings import InsightSetting


# --------------------------------------------------------------------------
# The shape of one setting
# --------------------------------------------------------------------------
UNITS = frozenset({"percent", "days", "weeks", "hours", "count", "switch"})


@dataclass(frozen=True)
class SettingDef:
    key: str            # what the rules and the table use
    group: str          # which section of the Settings tab
    label: str          # the field's name on screen
    help: str           # one line explaining it to a non-technical person
    default: float
    minimum: float      # the form and the API both refuse anything outside
    maximum: float
    # "switch" is a yes/no stored as 0 or 1. The Settings tab draws it as a
    # toggle rather than a number box; the range check then makes anything
    # other than 0 or 1 impossible to save.
    unit: str           # percent | days | weeks | hours | count | switch

    def __post_init__(self):
        """Check each entry as it is created, which happens when this module is
        imported -- so a mistake in the catalogue stops the app starting rather
        than producing a nonsensical threshold at three in the morning."""
        if self.minimum > self.maximum:
            raise ValueError(
                f"{self.key}: minimum {self.minimum} is above maximum {self.maximum}"
            )
        if not self.minimum <= self.default <= self.maximum:
            raise ValueError(
                f"{self.key}: default {self.default} is outside "
                f"{self.minimum}..{self.maximum}"
            )
        if self.unit not in UNITS:
            raise ValueError(f"{self.key}: unknown unit {self.unit!r}")
        if self.group not in GROUPS:
            # A typo here would hide the setting completely: settings_for_tab
            # walks GROUPS, so a group nobody recognises is never shown.
            raise ValueError(f"{self.key}: unknown group {self.group!r}")


# Sections of the Settings tab, in the order they should appear. A tuple, not a
# list, because nothing should ever be able to append to it at runtime.
GROUPS = ("General", "Kitchen and service", "Menu", "Marketing", "Guests and money")


# --------------------------------------------------------------------------
# The catalogue
# --------------------------------------------------------------------------
CATALOGUE: list[SettingDef] = [

    # ---------------------------- General --------------------------------
    SettingDef(
        key="cards_shown", group="General",
        label="Cards on the page",
        help="How many insights to show at the top. The rest sit behind 'show more'.",
        default=5, minimum=3, maximum=10, unit="count",
    ),
    SettingDef(
        key="window_days", group="General",
        label="Period to look at",
        help="How far back most insights look. A longer period is steadier but slower to notice a change.",
        default=30, minimum=7, maximum=120, unit="days",
    ),
    SettingDef(
        key="min_weeks_of_data", group="General",
        label="Weeks of data before trusting a weekly pattern",
        help="Insights about days of the week or times of day stay hidden until there is at least this much history.",
        default=4, minimum=1, maximum=12, unit="weeks",
    ),
    SettingDef(
        key="min_orders_to_trust", group="General",
        label="Minimum orders before showing insights",
        help="Below this many orders in the period, the page says there is not enough data yet.",
        default=150, minimum=20, maximum=2000, unit="count",
    ),
    SettingDef(
        key="card_expiry_days", group="General",
        label="How long a card lasts",
        help="A card disappears this many days after the pattern behind it stops.",
        default=14, minimum=1, maximum=60, unit="days",
    ),
    SettingDef(
        key="snooze_days", group="General",
        label="'Remind me later' length",
        help="How long a card stays hidden after someone snoozes it.",
        default=30, minimum=7, maximum=180, unit="days",
    ),
    SettingDef(
        key="stale_after_hours", group="General",
        label="Warn when the insights are this old",
        help="If the overnight job has not succeeded for this long, the page says so instead of quietly showing old cards.",
        default=36, minimum=6, maximum=168, unit="hours",
    ),
    SettingDef(
        key="auto_refresh", group="General",
        label="Work them out on demand if the overnight job has not run",
        help="A safety net: if the insights are stale, opening the page starts a run in the background. The page still loads straight away.",
        default=1, minimum=0, maximum=1, unit="switch",
    ),

    # ----------------------- Kitchen and service -------------------------
    SettingDef(
        key="busy_window_hours", group="Kitchen and service",
        label="Length of a busy window",
        help="How many hours in a row count as one busy window, for example 2 gives '7 to 9pm'.",
        default=2, minimum=1, maximum=4, unit="hours",
    ),
    SettingDef(
        key="busy_window_min_share_percent", group="Kitchen and service",
        label="Busy window share",
        help="A window is called busy when it takes at least this share of that day's orders.",
        default=25, minimum=10, maximum=60, unit="percent",
    ),
    SettingDef(
        key="quiet_window_max_share_percent", group="Kitchen and service",
        label="Quiet window share",
        help="A window is called quiet when it takes no more than this share of that day's orders.",
        default=6, minimum=1, maximum=20, unit="percent",
    ),
    SettingDef(
        key="cancellation_min_count", group="Kitchen and service",
        label="Minimum cancelled orders",
        help="Fewer cancellations than this are ignored, so one bad evening does not raise a card.",
        default=10, minimum=3, maximum=200, unit="count",
    ),
    SettingDef(
        key="cancellation_min_rise_percent", group="Kitchen and service",
        label="Cancellation rise",
        help="How far above your own usual rate cancellations must go before a card appears.",
        default=50, minimum=10, maximum=300, unit="percent",
    ),
    SettingDef(
        key="order_mix_min_change_percent", group="Kitchen and service",
        label="Change in what people order",
        help="How many percentage points a category's share of items sold must move, for example 22% to 30%.",
        default=8, minimum=2, maximum=40, unit="percent",
    ),

    # ------------------------------- Menu --------------------------------
    SettingDef(
        key="search_gap_min_searches", group="Menu",
        label="Minimum searches for a missing dish",
        help="How many guests must search for something you do not have before it becomes a card.",
        default=15, minimum=3, maximum=200, unit="count",
    ),
    SettingDef(
        key="viewed_not_added_min_views", group="Menu",
        label="Minimum views of a dish",
        help="A dish needs at least this many views before we judge whether people add it.",
        default=50, minimum=10, maximum=500, unit="count",
    ),
    SettingDef(
        key="viewed_not_added_max_add_percent", group="Menu",
        label="Low add-to-basket rate",
        help="If this share or fewer of the people who opened a dish added it, something on the page may be putting them off.",
        default=10, minimum=1, maximum=40, unit="percent",
    ),
    SettingDef(
        key="volume_revenue_min_units", group="Menu",
        label="Minimum sold for the price check",
        help="A dish must have sold at least this many before we compare how much it earns.",
        default=50, minimum=10, maximum=1000, unit="count",
    ),
    SettingDef(
        key="volume_revenue_min_gap_percent", group="Menu",
        label="Gap between what sells and what earns",
        help="How far a dish's share of revenue must fall below its share of items sold.",
        default=4, minimum=1, maximum=25, unit="percent",
    ),
    SettingDef(
        key="fading_item_min_drop_percent", group="Menu",
        label="Drop in a dish's sales",
        help="How far a dish must fall below its own earlier average before a card appears.",
        default=25, minimum=10, maximum=80, unit="percent",
    ),
    SettingDef(
        key="fading_item_min_baseline_units", group="Menu",
        label="Minimum earlier sales for a drop",
        help="A dish that never sold much cannot meaningfully fall, so it needs this much history first.",
        default=20, minimum=5, maximum=500, unit="count",
    ),
    SettingDef(
        key="dead_item_days", group="Menu",
        label="Days with no sales",
        help="A dish still on the menu with no sales for this many days becomes a card.",
        default=21, minimum=7, maximum=120, unit="days",
    ),

    # ----------------------------- Marketing -----------------------------
    SettingDef(
        key="send_time_min_campaigns", group="Marketing",
        label="Minimum campaigns for a send-time insight",
        help="The best time to send is only suggested once there are enough campaigns to compare.",
        default=4, minimum=2, maximum=30, unit="count",
    ),
    SettingDef(
        key="send_time_min_clicks", group="Marketing",
        label="Minimum clicks for a send-time insight",
        help="Below this many clicks in total, the pattern is too thin to act on.",
        default=30, minimum=10, maximum=500, unit="count",
    ),
    SettingDef(
        key="campaign_outlier_min_recipients", group="Marketing",
        label="Minimum recipients for a campaign comparison",
        help="Small sends swing wildly, so a campaign needs this many recipients to be compared.",
        default=100, minimum=20, maximum=5000, unit="count",
    ),
    SettingDef(
        key="campaign_outlier_min_difference_percent", group="Marketing",
        label="Campaign difference",
        help="How far a campaign's click rate must sit above or below your own average to be worth noting.",
        default=40, minimum=10, maximum=200, unit="percent",
    ),
    SettingDef(
        key="promo_page_min_visits", group="Marketing",
        label="Minimum page visits",
        help="A page needs this many visits before it is suggested as the place for a promotion.",
        default=200, minimum=20, maximum=5000, unit="count",
    ),
    SettingDef(
        key="link_weight_min_share_percent", group="Marketing",
        label="One link taking most clicks",
        help="A card appears when a single link takes at least this share of all email clicks.",
        default=35, minimum=15, maximum=80, unit="percent",
    ),
    SettingDef(
        key="lead_source_min_leads", group="Marketing",
        label="Minimum new leads",
        help="Below this many new subscribers, where they came from is not a reliable pattern.",
        default=25, minimum=5, maximum=500, unit="count",
    ),

    # ------------------------- Guests and money --------------------------
    SettingDef(
        key="returning_min_visits_each", group="Guests and money",
        label="Minimum visits on each side",
        help="New and returning guests each need this many visits before their spending is compared.",
        default=30, minimum=10, maximum=1000, unit="count",
    ),
    SettingDef(
        key="returning_min_difference_percent", group="Guests and money",
        label="Difference in spend per visit",
        help="How far apart new and returning guests must be before it is worth a card.",
        default=15, minimum=5, maximum=100, unit="percent",
    ),
    SettingDef(
        key="funnel_min_visits", group="Guests and money",
        label="Minimum QR visits for the funnel",
        help="The drop-off insight stays hidden until there are at least this many visits.",
        default=100, minimum=20, maximum=5000, unit="count",
    ),
    SettingDef(
        key="funnel_min_drop_percent", group="Guests and money",
        label="Drop between steps",
        help="How big the fall from one step to the next must be before it is called the weak point.",
        default=20, minimum=5, maximum=80, unit="percent",
    ),
    SettingDef(
        key="branch_gap_min_difference_percent", group="Guests and money",
        label="Gap between branches",
        help="How far apart two branches must be on spend per visit before a card appears.",
        default=10, minimum=3, maximum=100, unit="percent",
    ),
    SettingDef(
        key="table_underused_max_percent_of_median", group="Guests and money",
        label="Barely used table",
        help="A table's code counts as barely used when its scans are below this share of a typical table's.",
        default=25, minimum=5, maximum=70, unit="percent",
    ),
    SettingDef(
        key="table_underused_min_tables", group="Guests and money",
        label="Minimum tables to compare",
        help="With fewer tables in use than this, there is nothing fair to compare against.",
        default=5, minimum=3, maximum=50, unit="count",
    ),
]

SETTINGS_BY_KEY: dict[str, SettingDef] = {d.key: d for d in CATALOGUE}

DEFAULTS: dict[str, float] = {d.key: d.default for d in CATALOGUE}


class UnknownSetting(ValueError):
    """Raised for a key that is not in the catalogue."""


class SettingOutOfRange(ValueError):
    """Raised for a value outside the setting's safe range."""


# --------------------------------------------------------------------------
# Reading
# --------------------------------------------------------------------------
def get_settings(db: Session, tenant_id) -> dict[str, float]:
    """Every setting for this client: the default, overridden by anything saved.

    Saved values are clamped to the safe range on the way out, so a bad row in
    the table can never break a rule.
    """
    values = dict(DEFAULTS)
    rows = db.execute(
        select(InsightSetting).where(InsightSetting.tenant_id == tenant_id)
    ).scalars()
    for row in rows:
        definition = SETTINGS_BY_KEY.get(row.key)
        if definition is None:
            continue        # left over from a rule that no longer exists
        values[row.key] = min(max(float(row.value), definition.minimum), definition.maximum)
    return values


def settings_for_tab(db: Session, tenant_id) -> list[dict]:
    """What the Settings tab shows: one entry per setting, in group order,
    with its current value and whether it has been changed from the default."""
    saved = {
        row.key: row
        for row in db.execute(
            select(InsightSetting).where(InsightSetting.tenant_id == tenant_id)
        ).scalars()
    }
    out = []
    for group in GROUPS:
        for definition in CATALOGUE:
            if definition.group != group:
                continue
            row = saved.get(definition.key)
            out.append({
                "key": definition.key,
                "group": definition.group,
                "label": definition.label,
                "help": definition.help,
                "unit": definition.unit,
                "default": definition.default,
                "minimum": definition.minimum,
                "maximum": definition.maximum,
                "value": float(row.value) if row is not None else definition.default,
                "is_changed": row is not None,
                "updated_at": row.updated_at.isoformat() if row is not None else None,
                "updated_by_staff_id": str(row.updated_by_staff_id)
                if row is not None and row.updated_by_staff_id else None,
            })
    return out


# --------------------------------------------------------------------------
# Writing
# --------------------------------------------------------------------------
def set_setting(db: Session, tenant_id, key: str, value: float, staff_id=None) -> float:
    """Save one threshold. Raises UnknownSetting or SettingOutOfRange, which
    the endpoint turns into a 422. Does not commit: the caller does."""
    definition = SETTINGS_BY_KEY.get(key)
    if definition is None:
        raise UnknownSetting(key)
    value = float(value)
    if not (definition.minimum <= value <= definition.maximum):
        raise SettingOutOfRange(
            f"{definition.label} must be between {definition.minimum} and {definition.maximum}."
        )

    row = db.execute(
        select(InsightSetting).where(
            InsightSetting.tenant_id == tenant_id, InsightSetting.key == key
        )
    ).scalar_one_or_none()
    if row is None:
        db.add(InsightSetting(tenant_id=tenant_id, key=key, value=value, updated_by_staff_id=staff_id))
    else:
        row.value = value
        row.updated_by_staff_id = staff_id
    return value


def reset_setting(db: Session, tenant_id, key: str) -> float:
    """Put one threshold back to its default by deleting the saved row.
    Does not commit: the caller does."""
    definition = SETTINGS_BY_KEY.get(key)
    if definition is None:
        raise UnknownSetting(key)
    row = db.execute(
        select(InsightSetting).where(
            InsightSetting.tenant_id == tenant_id, InsightSetting.key == key
        )
    ).scalar_one_or_none()
    if row is not None:
        db.delete(row)
    return definition.default