from collections import defaultdict

from sqlalchemy import case, func, select

from app.models.branch import Branch                         
from app.models.main_menu_category import MainCategory        
from app.models.menu_item import MenuItem                     
from app.models.order_item import OrderItem                   
from app.models.orders import Order, OrderStatus              
from app.models.sub_menu_category import SubCategory          
from app.services.insights.rules.common import (
    WEEKDAYS, best_window, branch_names, hour_label, in_window, london,
    london_dow, london_hour, quietest_window, scaled, trading_span,
    window_label, with_order_scope,
)
from app.services.insights.registry import (
    AUDIENCE_DIRECTOR, AUDIENCE_MANAGER, SOURCE_ORDERS, Card, Context, rule,
)

# A window taking this share of a day is about as concentrated as a restaurant
# gets, so it earns the full impact.
VERY_CONCENTRATED = 0.60

DAYS_IN_WEEK = 7


# ==========================================================================
# Shared: orders per branch, weekday and hour -- both window rules need it
# ==========================================================================
def _orders_by_branch_weekday_hour(ctx: Context):
    """Returns two maps:

      hourly[(branch_id, dow)] -> 24 hourly order counts, London time
      weeks[(branch_id, dow)]  -> how many distinct dates of that weekday the
                                  window covers

    The second one is what stops a rule claiming a weekly pattern from one or
    two sightings. with_order_scope has already joined Table and Branch, so
    the branch comes straight out of the query.
    """
    hour_rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    Branch.id.label("branch_id"),
                    london_dow(Order.created_at).label("dow"),
                    london_hour(Order.created_at).label("hour"),
                    func.count(Order.id).label("orders"),
                ),
                ctx,
            ),
            ctx.since, ctx.now,
        ).group_by(Branch.id, "dow", "hour")
    ).all()

    week_rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    Branch.id.label("branch_id"),
                    london_dow(Order.created_at).label("dow"),
                    func.count(func.distinct(func.date(london(Order.created_at)))).label("days"),
                ),
                ctx,
            ),
            ctx.since, ctx.now,
        ).group_by(Branch.id, "dow")
    ).all()

    hourly: dict[tuple, list[int]] = defaultdict(lambda: [0] * 24)
    for branch_id, dow, hour, orders in hour_rows:
        hourly[(branch_id, int(dow))][int(hour)] = int(orders)

    weeks = {(branch_id, int(dow)): int(days) for branch_id, dow, days in week_rows}
    return hourly, weeks


@rule(
    key="busy_window",
    title="Your busiest window",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=(
        "busy_window_hours",
        "busy_window_min_share_percent",
        "min_weeks_of_data",
        "min_orders_to_trust",
        "window_days",
    ),
    # A standing pattern, not a change: Friday evenings do not become less
    # worth preparing for because you have known about them for a month.
    decays=False,
)
def busy_window(ctx: Context) -> list[Card]:
    """One card per branch: the weekday and hours taking the biggest share of
    that day's orders.

    One card, not one per weekday. Seven near-identical cards would fill the
    page and crowd out the other rules, and "your peak is Friday evening" is
    better advice than seven separate findings.
    """
    length = int(ctx.setting("busy_window_hours"))
    min_share = ctx.setting("busy_window_min_share_percent") / 100.0
    min_weeks = int(ctx.setting("min_weeks_of_data"))
    # A weekday needs its fair share of the client's own overall minimum
    # before any one of its hours means anything.
    min_orders_per_weekday = max(1, int(ctx.setting("min_orders_to_trust") / DAYS_IN_WEEK))
    window_days = int(ctx.setting("window_days"))

    hourly, weeks = _orders_by_branch_weekday_hour(ctx)

    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        candidates = []
        for dow in range(7):
            counts = hourly.get((branch_id, dow))
            if not counts:
                continue
            total = sum(counts)
            if total < min_orders_per_weekday:
                continue
            if weeks.get((branch_id, dow), 0) < min_weeks:
                continue

            start, in_peak = best_window(counts, length)
            if in_peak <= 0:
                continue
            share = in_peak / total
            if share < min_share:
                continue

            candidates.append({
                "weekday": WEEKDAYS[(dow - 1) % 7],         # Postgres 0 = Sunday
                "window": window_label(start, length),
                "start_hour": start,
                "opens_at": hour_label(start),
                "share": round(share, 3),
                "orders_in_window": in_peak,
                "orders_that_weekday": total,
                "weeks_seen": weeks[(branch_id, dow)],
            })

        if not candidates:
            continue

        # Qualify on share -- is this a real peak rather than just a busy
        # day? -- then rank on the absolute load in the window, because
        # that is the crunch a manager has to staff for. Ranking on share
        # alone would pick the most concentrated day over the busiest one.
        candidates.sort(key=lambda c: c["orders_in_window"], reverse=True)
        top = candidates[0]
        # Only days peaking in the SAME hours are "similar". Two days can
        # be equally concentrated at completely different times.
        runners_up = [
            c["weekday"] for c in candidates[1:]
            if c["start_hour"] == top["start_hour"]
        ][:2]

        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""
        detail = (
            f"{top['orders_in_window']} of {top['orders_that_weekday']} "
            f"{top['weekday']} orders arrive in those {length} hours, across "
            f"{top['weeks_seen']} {top['weekday']}s in the last {window_days} days."
        )
        if runners_up:
            detail += f" {' and '.join(runners_up)} look similar."

        cards.append(Card(
            subject_parts=("peak",),    # one ongoing "here is your peak" card per branch
            subject_label=f"{top['weekday']} {top['window']}",
            headline=(
                f"{top['weekday']}s {top['window']}{where} is when the kitchen is "
                f"busiest: {top['share']:.0%} of that day's orders."
            ),
            detail=detail,
            suggestion=(
                f"Have prep finished and the full team on before "
                f"{top['opens_at']} on {top['weekday']}s."
            ),
            evidence={
                "length_hours": length,
                "threshold_share": round(min_share, 3),
                "window_days": window_days,
                "peak": top,
                "other_weekdays": candidates[1:],
            },
            impact=scaled(top["share"], at_floor=min_share, at_full=VERY_CONCENTRATED),
            data_points=top["orders_that_weekday"],
            data_needed=min_orders_per_weekday,
            branch_id=branch_id,
        ))

    return cards


# ==========================================================================
# Quiet windows
# ==========================================================================
# A window with this share or less of the day is as empty as it gets, so it
# earns the full impact for this rule.
VERY_EMPTY = 0.0
# Cost-saving advice is worth less than service-failure advice, so these
# cards start from a lower floor than the busy-window ones.
QUIET_FLOOR = 0.25


@rule(
    key="quiet_window",
    title="Your quietest window",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=(
        "busy_window_hours",
        "quiet_window_max_share_percent",
        "min_weeks_of_data",
        "min_orders_to_trust",
        "window_days",
    ),
    decays=False,       # a standing pattern, like the busy window
)
def quiet_window(ctx: Context) -> list[Card]:
    """One card per branch: the emptiest stretch of trading, for shortening a
    shift or putting an offer on.

    Opening hours are not in the data, so a window with no orders at all is
    skipped: it is far more likely to be closing time than a quiet patch.
    "At least one order" is the only proxy available, and it means the rule
    can mistake the first hour of service for a quiet spell.
    """
    length = int(ctx.setting("busy_window_hours"))
    max_share = ctx.setting("quiet_window_max_share_percent") / 100.0
    min_weeks = int(ctx.setting("min_weeks_of_data"))
    min_orders_per_weekday = max(1, int(ctx.setting("min_orders_to_trust") / DAYS_IN_WEEK))
    window_days = int(ctx.setting("window_days"))

    hourly, weeks = _orders_by_branch_weekday_hour(ctx)
    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        candidates = []
        for dow in range(7):
            counts = hourly.get((branch_id, dow))
            if not counts:
                continue
            total = sum(counts)
            if total < min_orders_per_weekday:
                continue
            if weeks.get((branch_id, dow), 0) < min_weeks:
                continue

            start, in_window_orders = quietest_window(counts, length)
            if start < 0:
                continue                        # no window had any orders
            share = in_window_orders / total
            if share > max_share:
                continue

            span = trading_span(counts)
            candidates.append({
                "weekday": WEEKDAYS[(dow - 1) % 7],
                "window": window_label(start, length),
                "start_hour": start,
                "share": round(share, 3),
                "orders_in_window": in_window_orders,
                "orders_that_weekday": total,
                "weeks_seen": weeks[(branch_id, dow)],
                "trading_hours": window_label(span[0], span[1] - span[0] + 1) if span else None,
            })

        if not candidates:
            continue

        # Qualify on share -- is it genuinely a trough? -- then rank on the
        # absolute count, because one order in two hours is what makes a
        # shorter shift obvious. Same two-step as the busy window, reversed.
        candidates.sort(key=lambda c: c["orders_in_window"])
        top = candidates[0]

        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""
        per_day = top["orders_in_window"] / max(1, top["weeks_seen"])
        # "about 0.2 orders" reads as a mistake, so say it in words instead.
        how_many = (
            "Under one order" if per_day < 1
            else f"About {per_day:.0f} order{'s' if per_day >= 2 else ''}"
        )

        cards.append(Card(
            subject_parts=("quiet",),
            subject_label=f"{top['weekday']} {top['window']}",
            headline=(
                f"{top['weekday']}s {top['window']}{where} is your quietest trading "
                f"stretch: {top['share']:.0%} of that day's orders."
            ),
            detail=(
                f"{how_many} in those {length} hours on an average {top['weekday']}, "
                f"out of {top['orders_that_weekday']} across {top['weeks_seen']} "
                f"{top['weekday']}s. Trading hours are worked out from when orders "
                f"actually arrive, so check this against the rota."
            ),
            suggestion=(
                f"Either run a shorter shift over {top['window']} on "
                f"{top['weekday']}s, or put an offer on to fill it."
            ),
            evidence={
                "length_hours": length,
                "threshold_share": round(max_share, 3),
                "window_days": window_days,
                "quietest": top,
                "other_weekdays": candidates[1:],
            },
            # Emptier means more impact, so the distance BELOW the threshold is
            # what scales.
            impact=scaled(
                max_share - top["share"],
                at_floor=0.0, at_full=max_share - VERY_EMPTY, floor=QUIET_FLOOR,
            ),
            data_points=top["orders_that_weekday"],
            data_needed=min_orders_per_weekday,
            branch_id=branch_id,
        ))

    return cards


# ==========================================================================
# Cancellation spikes
# ==========================================================================
# Three times your usual rate is as bad as this card needs to get.
CANCELLATION_FULL_RISE = 2.0        # +200%


@rule(
    key="cancellation_spike",
    title="Cancellations above your usual rate",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=(
        "cancellation_min_count",
        "cancellation_min_rise_percent",
        "busy_window_hours",
        "window_days",
    ),
    decays=True,        # a change: a spike from three weeks ago is history
)
def cancellation_spike(ctx: Context) -> list[Card]:
    """One card per branch when the cancellation RATE has risen against the
    same length of time before it.

    The rate, not the count: a busier month cancels more orders without
    anything being wrong.
    """
    min_count = int(ctx.setting("cancellation_min_count"))
    min_rise = ctx.setting("cancellation_min_rise_percent") / 100.0
    length = int(ctx.setting("busy_window_hours"))
    window_days = int(ctx.setting("window_days"))

    # Both periods in one query, split by a CASE, so this costs one round trip
    # rather than two. cancelled=None leaves the status alone so the same rows
    # give both the total and the cancelled count.
    period = case((Order.created_at >= ctx.since, "current"), else_="previous")
    rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    Branch.id.label("branch_id"),
                    period.label("period"),
                    func.count(Order.id).label("total"),
                    func.count(Order.id)
                    .filter(Order.status == OrderStatus.cancelled)
                    .label("cancelled"),
                ),
                ctx, cancelled=None,
            ),
            ctx.prev_since, ctx.now,
        ).group_by(Branch.id, "period")
    ).all()

    counts: dict[tuple, tuple[int, int]] = {
        (branch_id, period_name): (int(total), int(cancelled))
        for branch_id, period_name, total, cancelled in rows
    }

    # When the cancellations cluster, for the detail line.
    cluster_rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    Branch.id.label("branch_id"),
                    london_dow(Order.created_at).label("dow"),
                    london_hour(Order.created_at).label("hour"),
                    func.count(Order.id).label("orders"),
                ),
                ctx, cancelled=True,
            ),
            ctx.since, ctx.now,
        ).group_by(Branch.id, "dow", "hour")
    ).all()

    clusters: dict[tuple, list[int]] = defaultdict(lambda: [0] * 24)
    for branch_id, dow, hour, orders in cluster_rows:
        clusters[(branch_id, int(dow))][int(hour)] += int(orders)

    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        now_total, now_cancelled = counts.get((branch_id, "current"), (0, 0))
        was_total, was_cancelled = counts.get((branch_id, "previous"), (0, 0))

        if now_cancelled < min_count:
            continue                            # too few to read anything into
        if now_total == 0 or was_total == 0:
            continue                            # nothing to compare against

        now_rate = now_cancelled / now_total
        was_rate = was_cancelled / was_total
        if was_rate <= 0:
            continue                            # no baseline, so no "rise"
        rise = (now_rate - was_rate) / was_rate
        if rise < min_rise:
            continue

        # Where they cluster: the worst weekday, and its worst window.
        worst_dow, worst_counts = None, None
        for dow in range(7):
            counts_for_day = clusters.get((branch_id, dow))
            if not counts_for_day:
                continue
            if worst_counts is None or sum(counts_for_day) > sum(worst_counts):
                worst_dow, worst_counts = dow, counts_for_day

        when = ""
        cluster_evidence = None
        if worst_counts is not None:
            start, in_peak = best_window(worst_counts, length)
            weekday = WEEKDAYS[(worst_dow - 1) % 7]
            if in_peak > 0:
                when = f" Most of them are {weekday}s around {window_label(start, length)}."
                cluster_evidence = {
                    "weekday": weekday, "window": window_label(start, length),
                    "cancellations_in_window": in_peak,
                    "cancellations_that_weekday": sum(worst_counts),
                }

        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""

        cards.append(Card(
            subject_parts=("cancellations",),
            subject_label=f"{now_cancelled} cancelled",
            headline=(
                f"Cancellations{where} are running at {now_rate:.1%} of orders, "
                f"up from {was_rate:.1%}."
            ),
            detail=(
                f"{now_cancelled} of {now_total} orders were cancelled in the last "
                f"{window_days} days, against {was_cancelled} of {was_total} in the "
                f"{window_days} before that.{when}"
            ),
            suggestion=(
                "Ask the team what is behind them: items out of stock, waits too "
                "long, or orders being put through twice."
            ),
            evidence={
                "window_days": window_days,
                "current": {"cancelled": now_cancelled, "total": now_total,
                            "rate": round(now_rate, 4)},
                "previous": {"cancelled": was_cancelled, "total": was_total,
                             "rate": round(was_rate, 4)},
                "rise": round(rise, 3),
                "cluster": cluster_evidence,
            },
            impact=scaled(rise, at_floor=min_rise, at_full=CANCELLATION_FULL_RISE),
            data_points=now_cancelled,
            data_needed=min_count,
            branch_id=branch_id,
        ))

    return cards


# ==========================================================================
# A change in what people order
# ==========================================================================
# A category's share moving this many percentage points is a big shift.
MIX_FULL_CHANGE_POINTS = 20.0
# At most this many movers per branch, so one noisy menu cannot fill the page.
MAX_MIX_CARDS_PER_BRANCH = 2


@rule(
    key="order_mix_shift",
    title="A change in what people order",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=("order_mix_min_change_percent", "min_orders_to_trust", "window_days"),
    decays=True,        # a change, so it fades once it is old news
)
def order_mix_shift(ctx: Context) -> list[Card]:
    """Which menu categories have grown or shrunk as a share of items sold,
    against the same length of time before.

    Shares, not counts: a busier month sells more of everything without the
    mix having changed at all.

    The threshold is in PERCENTAGE POINTS, so 8 means a category going from
    22% of items to 30%. Not 8% of 22%.
    """
    min_change_points = ctx.setting("order_mix_min_change_percent")
    window_days = int(ctx.setting("window_days"))
    min_total_units = int(ctx.setting("min_orders_to_trust"))
    # A category has to be big enough that the threshold means something: one
    # sold out of six is a 17 point swing and tells you nothing.
    min_category_units = max(5, int(min_total_units * min_change_points / 100))

    period = case((Order.created_at >= ctx.since, "current"), else_="previous")
    rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    Branch.id.label("branch_id"),
                    MainCategory.id.label("category_id"),
                    MainCategory.name.label("category"),
                    period.label("period"),
                    func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
                .join(SubCategory, SubCategory.id == MenuItem.sub_category_id)
                .join(MainCategory, MainCategory.id == SubCategory.main_category_id),
                ctx,
            ),
            ctx.prev_since, ctx.now,
        ).group_by(Branch.id, "category_id", "category", "period")
    ).all()

    units: dict[tuple, int] = {}
    totals: dict[tuple, int] = defaultdict(int)
    labels: dict = {}
    for branch_id, category_id, category, period_name, sold in rows:
        sold = int(sold or 0)
        units[(branch_id, category_id, period_name)] = sold
        totals[(branch_id, period_name)] += sold
        labels[category_id] = category

    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        now_total = totals.get((branch_id, "current"), 0)
        was_total = totals.get((branch_id, "previous"), 0)
        if now_total < min_total_units or was_total < min_total_units:
            continue                        # not enough trading either side

        category_ids = {cid for (b, cid, _p) in units if b == branch_id}
        movers = []
        for category_id in category_ids:
            now_units = units.get((branch_id, category_id, "current"), 0)
            was_units = units.get((branch_id, category_id, "previous"), 0)
            if max(now_units, was_units) < min_category_units:
                continue                    # too small for the swing to mean anything

            now_share = now_units / now_total
            was_share = was_units / was_total
            change_points = (now_share - was_share) * 100
            if abs(change_points) < min_change_points:
                continue

            movers.append({
                "category_id": category_id,
                "category": labels.get(category_id, "that category"),
                "now_share": round(now_share, 3),
                "was_share": round(was_share, 3),
                "change_points": round(change_points, 1),
                "now_units": now_units,
                "was_units": was_units,
            })

        movers.sort(key=lambda m: abs(m["change_points"]), reverse=True)
        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""

        for mover in movers[:MAX_MIX_CARDS_PER_BRANCH]:
            rising = mover["change_points"] > 0
            direction = "up" if rising else "down"
            cards.append(Card(
                subject_parts=("category", mover["category_id"]),
                subject_label=mover["category"],
                headline=(
                    f"{mover['category']}{where} is {mover['now_share']:.0%} of items "
                    f"sold, {direction} from {mover['was_share']:.0%}."
                ),
                detail=(
                    f"{mover['now_units']} sold in the last {window_days} days against "
                    f"{mover['was_units']} in the {window_days} before, a shift of "
                    f"{abs(mover['change_points']):.0f} points in its share of the menu. "
                    f"This is about the mix, not the totals: both periods are compared "
                    f"as shares."
                ),
                suggestion=(
                    f"Check prep and stock for {mover['category']} match the new level."
                    if rising else
                    f"Worth asking why {mover['category']} has slipped: price, "
                    f"placement on the menu, or something off about the dishes."
                ),
                evidence={
                    "window_days": window_days,
                    "branch_totals": {"current": now_total, "previous": was_total},
                    "mover": mover,
                    "threshold_points": min_change_points,
                },
                impact=scaled(
                    abs(mover["change_points"]),
                    at_floor=min_change_points, at_full=MIX_FULL_CHANGE_POINTS,
                ),
                data_points=max(mover["now_units"], mover["was_units"]),
                data_needed=min_category_units,
                branch_id=branch_id,
            ))

    return cards