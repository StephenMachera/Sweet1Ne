"""
app/services/insights/rules/menu.py

Rules about the menu itself: what is missing from it, what people look at but
do not order, what sells a lot without earning much, what is fading, and what
has stopped selling altogether.

Every card here is COMPANY-WIDE (branch_id=None). Adding a dish, repricing
one or taking one off is a menu decision rather than a branch one, and
keeping the branches together leaves the sample whole instead of halving it.
If the branches ever run different menus, these need splitting per branch.
"""
from datetime import timedelta

from sqlalchemy import func, select

from app.models.guest_activity import GuestActivity            # ADJUST
from app.models.main_menu_category import MainCategory         # ADJUST
from app.models.menu_item import MenuItem                      # ADJUST
from app.models.order_item import OrderItem                    # ADJUST
from app.models.orders import Order                            # ADJUST
from app.models.sub_menu_category import SubCategory           # ADJUST
from app.services.insights.rules.common import in_window, scaled, with_order_scope
from app.services.insights.registry import (
    AUDIENCE_DIRECTOR, AUDIENCE_MANAGER, SOURCE_ACTIVITY, SOURCE_ORDERS,
    Card, Context, rule,
)

# At most this many cards per rule, so one noisy menu cannot fill the page.
MAX_CARDS = 3

# How far past its own threshold a finding has to go to earn the full impact.
FULL_AT_MULTIPLE = 4.0

# How far back to look when deciding whether a dish ever sold at all.
EVER_SOLD_DAYS = 180

# The illustrative price rise used by the pricing-lever card. Small enough
# to be plausible without a demand model behind it.
TEST_RISE = 0.10

# Hardcoded because the client trades in the UK. If Sweet1NE ever runs
# somewhere else this belongs in the settings catalogue, not here.
CURRENCY = "\u00a3"


def _tenant_menu_items(ctx: Context) -> dict:
    """Every menu item belonging to this client: id -> title.

    A menu item has no tenant of its own, so this goes
    MenuItem -> SubCategory -> MainCategory, the same walk report.py uses.
    """
    rows = ctx.db.execute(
        select(MenuItem.id, MenuItem.title)
        .join(SubCategory, SubCategory.id == MenuItem.sub_category_id)
        .join(MainCategory, MainCategory.id == SubCategory.main_category_id)
        .where(MainCategory.tenant_id == ctx.tenant_id)
    ).all()
    return {item_id: title for item_id, title in rows}


def _activity_scope(ctx: Context, activity_type: str, since, until):
    """Tracked events of one type for this client. GuestActivity carries its
    own tenant_id, so no joins are needed."""
    return [
        GuestActivity.tenant_id == ctx.tenant_id,
        GuestActivity.type == activity_type,
        GuestActivity.occurred_at >= since,
        GuestActivity.occurred_at < until,
    ]


# ==========================================================================
# 1. Things guests searched for and did not find
# ==========================================================================
@rule(
    key="menu_gap_search",
    title="Searched for and not found",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ACTIVITY,),
    settings=("search_gap_min_searches", "window_days"),
    decays=False,       # the gap stays until you do something about it
)
def menu_gap_search(ctx: Context) -> list[Card]:
    """What guests typed into the menu search and got nothing back.

    This is the clearest signal on the whole page: somebody wanted to spend
    money and could not. It relies on the QR menu sending the real number of
    results, so a frontend that always sends 0 would make every search look
    like a gap.
    """
    min_searches = int(ctx.setting("search_gap_min_searches"))
    window_days = int(ctx.setting("window_days"))

    # Lower-cased and trimmed, so "Pizza " and "pizza" are one term.
    term = func.lower(func.trim(GuestActivity.search_text))
    rows = ctx.db.execute(
        select(
            term.label("term"),
            func.count(GuestActivity.id).label("searches"),
            func.count(func.distinct(GuestActivity.session_id)).label("people"),
        )
        .where(
            *_activity_scope(ctx, "search", ctx.since, ctx.now),
            GuestActivity.search_text.is_not(None),
            GuestActivity.results_count == 0,
        )
        .group_by("term")
        .having(func.count(GuestActivity.id) >= min_searches)
        .order_by(func.count(GuestActivity.id).desc())
    ).all()

    others = [r[0] for r in rows[MAX_CARDS:]]
    also = (
        f" {len(others)} other term{'s' if len(others) != 1 else ''} came up empty too."
        if others else ""
    )

    cards: list[Card] = []
    for searched_for, searches, people in rows[:MAX_CARDS]:
        cards.append(Card(
            subject_parts=("search", searched_for),
            subject_label=searched_for,
            headline=(
                f"{searches} searches for “{searched_for}” found nothing "
                f"on the menu."
            ),
            detail=(
                f"From {people} separate visits in the last {window_days} days. "
                f"These are guests who wanted to order something and could not."
                + also
            ),
            suggestion=(
                f"Either add something for “{searched_for}”, or rename an "
                f"existing dish so the search finds it."
            ),
            evidence={
                "term": searched_for,
                "searches": searches,
                "visits": people,
                "window_days": window_days,
                "threshold": min_searches,
                "other_empty_terms": others[:10],
            },
            impact=scaled(searches, at_floor=min_searches,
                          at_full=min_searches * FULL_AT_MULTIPLE),
            data_points=searches,
            data_needed=min_searches,
            branch_id=None,
        ))
    return cards


# ==========================================================================
# 2. Dishes people open but do not add
# ==========================================================================
@rule(
    key="viewed_not_added",
    title="Looked at but not ordered",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ACTIVITY,),
    settings=("viewed_not_added_min_views", "viewed_not_added_max_add_percent",
              "window_days"),
    decays=False,
)
def viewed_not_added(ctx: Context) -> list[Card]:
    """Dishes guests open on the QR menu and then do not add to the basket.

    Interest without an order usually points at the page rather than the dish:
    the photo, the description, or the price.
    """
    min_views = int(ctx.setting("viewed_not_added_min_views"))
    max_add_rate = ctx.setting("viewed_not_added_max_add_percent") / 100.0
    window_days = int(ctx.setting("window_days"))

    def counts_for(activity_type: str) -> dict:
        rows = ctx.db.execute(
            select(GuestActivity.menu_item_id, func.count(GuestActivity.id))
            .where(
                *_activity_scope(ctx, activity_type, ctx.since, ctx.now),
                GuestActivity.menu_item_id.is_not(None),
            )
            .group_by(GuestActivity.menu_item_id)
        ).all()
        return {item_id: int(count) for item_id, count in rows}

    views = counts_for("item_view")
    adds = counts_for("add_to_basket")
    titles = _tenant_menu_items(ctx)

    candidates = []
    for item_id, view_count in views.items():
        if view_count < min_views:
            continue
        add_count = adds.get(item_id, 0)
        add_rate = add_count / view_count
        if add_rate > max_add_rate:
            continue
        candidates.append({
            "menu_item_id": str(item_id),
            "title": titles.get(item_id, "A dish"),
            "views": view_count,
            "adds": add_count,
            "add_rate": round(add_rate, 4),
        })

    # Worst rate first, and among equals the one with the most views, since
    # that is the most wasted interest.
    candidates.sort(key=lambda c: (c["add_rate"], -c["views"]))

    cards: list[Card] = []
    for item in candidates[:MAX_CARDS]:
        cards.append(Card(
            subject_parts=("item", item["menu_item_id"]),
            subject_label=item["title"],
            headline=(
                f"{item['title']} was opened {item['views']} times and added "
                f"{item['adds']} times."
            ),
            detail=(
                f"An add rate of {item['add_rate']:.0%} over the last {window_days} "
                f"days. Guests are interested enough to look, so what puts them "
                f"off is usually on the page rather than in the kitchen."
            ),
            suggestion=(
                f"Look at {item['title']}'s photo, description and price on the QR "
                f"menu, and compare them with a dish that sells well."
            ),
            evidence={
                "window_days": window_days,
                "item": item,
                "min_views": min_views,
                "max_add_rate": round(max_add_rate, 3),
            },
            # A lower add rate is worse, so the distance below the threshold scales.
            impact=scaled(max_add_rate - item["add_rate"],
                          at_floor=0.0, at_full=max_add_rate),
            data_points=item["views"],
            data_needed=min_views,
            branch_id=None,
        ))
    return cards


# ==========================================================================
# 3. Sells plenty, earns little
# ==========================================================================
@rule(
    key="high_volume_low_revenue",
    title="Your biggest pricing lever",
    audiences=(AUDIENCE_DIRECTOR,),
    requires=(SOURCE_ORDERS,),
    settings=("volume_revenue_min_units", "volume_revenue_min_gap_percent",
              "window_days"),
    decays=False,
)
def high_volume_low_revenue(ctx: Context) -> list[Card]:
    """The item carrying a much bigger share of its category's volume than of
    its category's revenue -- in other words, the cheap popular one.

    Framed as a pricing lever rather than a problem, on purpose. With no cost
    data we cannot say an item is unprofitable, and "your cheapest popular
    drink is cheap" is not advice. What we CAN say is where a small price
    change moves the most money, because that follows from volume alone.

    The comparison is within the category: against the whole menu it would
    flag every drink and every side, which are meant to be cheap and
    high-volume.
    """
    min_units = int(ctx.setting("volume_revenue_min_units"))
    min_gap_points = ctx.setting("volume_revenue_min_gap_percent")
    window_days = int(ctx.setting("window_days"))

    rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    MainCategory.id.label("category_id"),
                    MainCategory.name.label("category"),
                    MenuItem.id.label("item_id"),
                    MenuItem.title.label("title"),
                    func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
                    func.coalesce(func.sum(OrderItem.total_price), 0).label("revenue"),
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(MenuItem, MenuItem.id == OrderItem.menu_item_id)
                .join(SubCategory, SubCategory.id == MenuItem.sub_category_id)
                .join(MainCategory, MainCategory.id == SubCategory.main_category_id),
                ctx,
            ),
            ctx.since, ctx.now,
        ).group_by("category_id", "category", "item_id", "title")
    ).all()

    # Totals per category, because that is what each item is measured against.
    cat_units: dict = {}
    cat_revenue: dict = {}
    cat_items: dict = {}
    for row in rows:
        cat_units[row.category_id] = cat_units.get(row.category_id, 0) + int(row.units)
        cat_revenue[row.category_id] = cat_revenue.get(row.category_id, 0.0) + float(row.revenue)
        cat_items[row.category_id] = cat_items.get(row.category_id, 0) + 1

    candidates = []
    for row in rows:
        units, revenue = int(row.units), float(row.revenue)
        if units < min_units:
            continue
        # A category of one: the item is 100% of both shares, so the gap is
        # always zero and there is nothing to compare it with.
        if cat_items.get(row.category_id, 0) < 2:
            continue
        total_units = cat_units[row.category_id]
        total_revenue = cat_revenue[row.category_id]
        if total_units == 0 or total_revenue == 0:
            continue

        unit_share = units / total_units
        revenue_share = revenue / total_revenue
        gap_points = (unit_share - revenue_share) * 100
        if gap_points < min_gap_points:
            continue
        candidates.append({
            "menu_item_id": str(row.item_id),
            "title": row.title,
            "category": row.category,
            "units": units,
            "revenue": round(revenue, 2),
            "unit_share": round(unit_share, 3),
            "revenue_share": round(revenue_share, 3),
            "gap_points": round(gap_points, 1),
            "average_price": round(revenue / units, 2),
            "category_units": total_units,
            "category_revenue": round(total_revenue, 2),
            # What the rest of the category charges, and what a 10% rise on
            # this one item would have added over the same period. Arithmetic
            # only: it assumes demand holds, which is exactly what a trial
            # would test.
            "others_average_price": (
                round((total_revenue - revenue) / (total_units - units), 2)
                if total_units > units else None
            ),
            "ten_percent_rise_adds": round(revenue * TEST_RISE, 2),
            "test_rise_percent": int(TEST_RISE * 100),
        })

    candidates.sort(key=lambda c: c["gap_points"], reverse=True)

    cards: list[Card] = []
    for item in candidates[:MAX_CARDS]:
        cards.append(Card(
            subject_parts=("item", item["menu_item_id"]),
            subject_label=item["title"],
            headline=(
                f"{item['title']} is {item['unit_share']:.0%} of the "
                f"{item['category']} you sell, at {CURRENCY}{item['average_price']:.2f} each: "
                f"your biggest pricing lever in {item['category']}."
            ),
            detail=(
                f"{item['units']} sold over {window_days} days, taking "
                f"{item['revenue_share']:.0%} of what {item['category']} earns"
                + (
                    f", while the rest of {item['category']} averages "
                    f"{CURRENCY}{item['others_average_price']:.2f}"
                    if item["others_average_price"] is not None else ""
                )
                + f". A {item['test_rise_percent']}% rise would have added about "
                f"{CURRENCY}{item['ten_percent_rise_adds']:.0f} over the same {window_days} "
                f"days, if the same number of people still bought it. That last "
                f"part is the bit to test, not assume."
            ),
            suggestion=(
                f"Because of the volume, a small rise on {item['title']} moves more "
                f"money than a large one anywhere else in {item['category']}. Try it "
                f"for a fortnight and watch whether the count holds."
            ),
            evidence={
                "window_days": window_days,
                "item": item,
                "compared_within": item["category"],
                "threshold_points": min_gap_points,
            },
            impact=scaled(item["gap_points"], at_floor=min_gap_points,
                          at_full=min_gap_points * FULL_AT_MULTIPLE),
            data_points=item["units"],
            data_needed=min_units,
            branch_id=None,
        ))
    return cards


# ==========================================================================
# 4. Dishes that are fading
# ==========================================================================
@rule(
    key="fading_item",
    title="Fading dishes",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=("fading_item_min_drop_percent", "fading_item_min_baseline_units",
              "window_days"),
    decays=True,        # a change, so it fades once it is old news
)
def fading_item(ctx: Context) -> list[Card]:
    """Dishes selling well below what they used to.

    Compared against the dish's own earlier sales, not against other dishes,
    so a quiet month on the whole menu does not light up every card.
    """
    min_drop = ctx.setting("fading_item_min_drop_percent") / 100.0
    min_baseline = int(ctx.setting("fading_item_min_baseline_units"))
    window_days = int(ctx.setting("window_days"))

    def units_between(since, until) -> dict:
        rows = ctx.db.execute(
            in_window(
                with_order_scope(
                    select(
                        MenuItem.id.label("item_id"),
                        MenuItem.title.label("title"),
                        func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
                    )
                    .select_from(Order)
                    .join(OrderItem, OrderItem.order_id == Order.id)
                    .join(MenuItem, MenuItem.id == OrderItem.menu_item_id),
                    ctx,
                ),
                since, until,
            ).group_by("item_id", "title")
        ).all()
        return {r.item_id: (r.title, int(r.units)) for r in rows}

    now_units = units_between(ctx.since, ctx.now)
    was_units = units_between(ctx.prev_since, ctx.since)

    # Was the whole menu quieter? If so, say so rather than blaming the dish.
    now_total = sum(u for _t, u in now_units.values())
    was_total = sum(u for _t, u in was_units.values())
    menu_change = ((now_total - was_total) / was_total) if was_total else 0.0

    candidates = []
    for item_id, (title, before) in was_units.items():
        if before < min_baseline:
            continue                        # never sold enough to fall from
        after = now_units.get(item_id, (title, 0))[1]
        drop = (before - after) / before
        if drop < min_drop:
            continue
        candidates.append({
            "menu_item_id": str(item_id),
            "title": title,
            "sold_before": before,
            "sold_now": after,
            "drop": round(drop, 3),
            "units_lost": before - after,
        })

    # Qualify on the percentage drop -- is this a real fall? -- then rank on
    # the units lost. A dish falling 91% from 22 sales matters less than one
    # falling 72% from 64, and the second is the one to look at first.
    candidates.sort(key=lambda c: c["units_lost"], reverse=True)

    cards: list[Card] = []
    for item in candidates[:MAX_CARDS]:
        context_line = ""
        if menu_change <= -0.10:
            context_line = (
                f" The whole menu is down {abs(menu_change):.0%} over the same time, "
                f"so some of this is trade rather than the dish."
            )
        cards.append(Card(
            subject_parts=("item", item["menu_item_id"]),
            subject_label=item["title"],
            headline=(
                f"{item['title']} is down {item['drop']:.0%} on its own recent average."
            ),
            detail=(
                f"{item['sold_now']} sold in the last {window_days} days against "
                f"{item['sold_before']} in the {window_days} before.{context_line}"
            ),
            suggestion=(
                f"Check whether anything changed: the recipe, the price, where it "
                f"sits on the menu, or who is cooking it."
            ),
            evidence={
                "window_days": window_days,
                "item": item,
                "menu_change": round(menu_change, 3),
                "threshold_drop": round(min_drop, 3),
            },
            impact=scaled(item["drop"], at_floor=min_drop, at_full=1.0),
            data_points=item["sold_before"],
            data_needed=min_baseline,
            branch_id=None,
        ))
    return cards


# ==========================================================================
# 5. Dishes that have stopped selling
# ==========================================================================
@rule(
    key="dead_item",
    title="Dishes that have stopped selling",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_ORDERS,),
    settings=("dead_item_days",),
    decays=False,       # a standing condition: longer dead is worse, not stale
)
def dead_item(ctx: Context) -> list[Card]:
    """Dishes still on the menu that used to sell and have now stopped.

    A dish that has NEVER sold is left out on purpose: that is a dish nobody
    has launched or priced yet, not a dish that has died, and the advice would
    be wrong.
    """
    dead_days = int(ctx.setting("dead_item_days"))
    dead_since = ctx.now - timedelta(days=dead_days)
    ever_since = ctx.now - timedelta(days=EVER_SOLD_DAYS)

    # When each dish last sold, looking back further than the usual window.
    last_sold_rows = ctx.db.execute(
        in_window(
            with_order_scope(
                select(
                    MenuItem.id.label("item_id"),
                    func.max(OrderItem.created_at).label("last_sold"),
                    func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
                )
                .select_from(Order)
                .join(OrderItem, OrderItem.order_id == Order.id)
                .join(MenuItem, MenuItem.id == OrderItem.menu_item_id),
                ctx,
            ),
            ever_since, ctx.now,
        ).group_by("item_id")
    ).all()
    last_sold = {r.item_id: (r.last_sold, int(r.units)) for r in last_sold_rows}

    titles = _tenant_menu_items(ctx)

    candidates = []
    for item_id, title in titles.items():
        sold = last_sold.get(item_id)
        if sold is None:
            continue                        # never sold: not dead, just unlaunched
        when, units = sold
        if when is None or when >= dead_since:
            continue                        # sold recently enough
        days_quiet = int((ctx.now - when).total_seconds() // 86400)
        candidates.append({
            "menu_item_id": str(item_id),
            "title": title,
            "days_quiet": days_quiet,
            "last_sold": when.date().isoformat(),
            "sold_in_last_6_months": units,
        })

    candidates.sort(key=lambda c: c["days_quiet"], reverse=True)

    cards: list[Card] = []
    for item in candidates[:MAX_CARDS]:
        also = len(candidates) - 1
        extra = (
            f" {also} other dish{'es' if also != 1 else ''} on the menu "
            f"{'are' if also != 1 else 'is'} in the same position."
            if also > 0 else ""
        )
        cards.append(Card(
            subject_parts=("item", item["menu_item_id"]),
            subject_label=item["title"],
            headline=(
                f"{item['title']} has sold nothing in {item['days_quiet']} days."
            ),
            detail=(
                f"It last sold on {item['last_sold']}, having sold "
                f"{item['sold_in_last_6_months']} in the last six months. It is "
                f"still on the menu, taking up space and attention.{extra}"
            ),
            suggestion=(
                f"Take {item['title']} off, or give it a week on the specials board "
                f"and see whether anyone orders it."
            ),
            evidence={
                "item": item,
                "threshold_days": dead_days,
                "others_dead": also,
            },
            impact=scaled(item["days_quiet"], at_floor=dead_days,
                          at_full=dead_days * FULL_AT_MULTIPLE),
            data_points=item["days_quiet"],
            data_needed=dead_days,
            branch_id=None,
        ))
    return cards