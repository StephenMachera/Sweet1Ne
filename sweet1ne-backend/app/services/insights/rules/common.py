import uuid

from sqlalchemy import func, select

from app.models.branch import Branch                 
from app.models.orders import Order, OrderStatus         
from app.models.table import Table                        
from app.services.insights.registry import Context

LONDON = "Europe/London"

# Postgres extract('dow') gives 0 for Sunday. We present Monday first, so the
# conversion lives in one place: WEEKDAYS[(dow - 1) % 7].
WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


# --------------------------------------------------------------------------
# 1. Order scoping -- the same Order -> Table -> Branch walk report.py uses,
#    because an order carries no tenant or branch of its own.
# --------------------------------------------------------------------------
def with_order_scope(stmt, ctx: Context, *, cancelled: bool | None = False, branch_id=None):
    """Add this client's scoping to a select over Order.

    cancelled=False  the orders that count, cancelled ones left out. The normal case.
    cancelled=True   only the cancelled ones.
    cancelled=None   no status filter at all, so one query can count both. The
                     cancellation rule needs this to work out a rate.
    """
    stmt = (
        stmt.join(Table, Table.id == Order.table_id)
        .join(Branch, Branch.id == Table.branch_id)
        .where(Branch.tenant_id == ctx.tenant_id)
    )
    if cancelled is True:
        stmt = stmt.where(Order.status == OrderStatus.cancelled)
    elif cancelled is False:
        stmt = stmt.where(Order.status != OrderStatus.cancelled)
    # cancelled is None: leave the status alone.
    if branch_id is not None:
        stmt = stmt.where(Branch.id == branch_id)
    return stmt


def in_window(stmt, since, until):
    return stmt.where(Order.created_at >= since, Order.created_at < until)


def branch_names(ctx: Context) -> dict[uuid.UUID, str]:
    """Branch id -> name, so a card can say "at Chingford"."""
    return dict(
        ctx.db.execute(
            select(Branch.id, Branch.name).where(Branch.tenant_id == ctx.tenant_id)
        ).all()
    )


# --------------------------------------------------------------------------
# 2. London time, inside the query
# --------------------------------------------------------------------------
def london(column):
    """Convert a stored UTC timestamp to London time in SQL.

    Everything the client reads must be in their own time. The older /report
    endpoint uses UTC, which is an hour out through British summer time.
    """
    return func.timezone(LONDON, column)


def london_hour(column):
    return func.extract("hour", london(column))


def london_dow(column):
    return func.extract("dow", london(column))      # 0 = Sunday


def hour_label(hour: int) -> str:
    """0 -> '12am', 13 -> '1pm', 24 -> '12am'."""
    hour = int(hour) % 24
    suffix = "am" if hour < 12 else "pm"
    return f"{hour % 12 or 12}{suffix}"


def window_label(start_hour: int, length: int) -> str:
    """19, 2 -> '7 to 9pm'. Keeps both halves when dropping one would mislead.

    The repeated am/pm is only dropped for a window that stays inside one half
    of the day. Matching suffixes alone is not enough: 11am to 12am also
    matches, and '11 to 12am' reads as 11pm.
    """
    start = int(start_hour) % 24
    raw_end = start + int(length)                   # not wrapped, for the test below
    start_text, end_text = hour_label(start), hour_label(raw_end)
    same_half = raw_end <= 24 and (start // 12) == ((raw_end - 1) // 12)
    if same_half and start_text[-2:] == end_text[-2:]:
        return f"{start_text[:-2]} to {end_text}"
    return f"{start_text} to {end_text}"


# --------------------------------------------------------------------------
# 3. Turning a measurement into an impact between 0 and 1
# --------------------------------------------------------------------------
def scaled(value: float, at_floor: float, at_full: float, floor: float = 0.35) -> float:
    """Map a measurement onto 0..1 for Card.impact.

    A card that only just passed its threshold should not score the same as
    one far beyond it, and it should not score zero either -- it did qualify.
    So `at_floor` (usually the threshold) gives `floor`, and `at_full` or
    anything past it gives 1.0.

        scaled(0.26, at_floor=0.25, at_full=0.60)  -> 0.37
        scaled(0.50, at_floor=0.25, at_full=0.60)  -> 0.81
        scaled(0.90, at_floor=0.25, at_full=0.60)  -> 1.00
    """
    if at_full == at_floor:
        return 1.0
    position = (value - at_floor) / (at_full - at_floor)
    position = min(1.0, max(0.0, position))
    return round(floor + (1.0 - floor) * position, 4)


def best_window(hourly: list[int], length: int) -> tuple[int, int]:
    """The busiest run of `length` hours in a 24-hour day.

    Returns (start_hour, orders_in_that_window).

    No wraparound: a window never crosses midnight. So a peak running from
    11pm to 1am is reported as two separate quieter windows rather than one
    busy one. Fine for a kitchen that closes before midnight; worth revisiting
    if the bar trades later.
    """
    if length <= 0 or length > 24:
        raise ValueError("length must be 1..24")
    best_start, best_total = 0, -1
    for start in range(0, 24 - length + 1):
        total = sum(hourly[start : start + length])
        if total > best_total:
            best_start, best_total = start, total
    return best_start, best_total


def trading_span(hourly: list[int]) -> tuple[int, int] | None:
    """The first and last hour of the day that saw an order.

    Opening hours are not recorded anywhere, so this is the only way to tell
    trading time from closed time. Returns None for a day with no orders.
    """
    hours = [h for h, count in enumerate(hourly) if count > 0]
    return (hours[0], hours[-1]) if hours else None


def quietest_window(hourly: list[int], length: int) -> tuple[int, int]:
    """The quietest run of `length` hours *within trading hours*.

    Two guards, both needed:

    - the window must sit entirely inside the trading span, or the answer is
      always "the hours before you open", which is true and useless;
    - the window must contain at least one order, so the rule never advises
      shortening a shift over a split-service closure.

    The cost of the second guard is that a genuine lull with literally no
    orders is skipped. That is the safer way round: silence beats telling a
    manager to cut staff from a period they are already closed for.

    Returns (start_hour, orders), or (-1, 0) when nothing qualifies.
    """
    if length <= 0 or length > 24:
        raise ValueError("length must be 1..24")
    span = trading_span(hourly)
    if span is None:
        return -1, 0
    first, last = span
    if last - first + 1 < length:
        return -1, 0                    # trades for less time than one window

    best_start, best_total = -1, None
    for start in range(first, last - length + 2):
        total = sum(hourly[start : start + length])
        if total == 0:
            continue
        if best_total is None or total < best_total:
            best_start, best_total = start, total
    return best_start, (best_total or 0)