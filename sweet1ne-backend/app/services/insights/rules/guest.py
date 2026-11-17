from statistics import median

from sqlalchemy import func, select

from app.models.guest_activity import GuestActivity            
from app.models.guest_profile import GuestProfile              
from app.models.guest_session import GuestSession              
from app.models.orders import Order, OrderStatus               
from app.models.table import Table                             
from app.services.insights.rules.common import branch_names, scaled
from app.services.insights.registry import (
    AUDIENCE_DIRECTOR, AUDIENCE_MANAGER, SOURCE_ACTIVITY, SOURCE_ORDERS,
    SOURCE_QR_VISITS, Card, Context, rule,
)

# See menu.py: hardcoded because the client trades in the UK.
CURRENCY = "£"

MAX_TABLES_NAMED = 5
FULL_AT_MULTIPLE = 4.0


def _session_scope(ctx: Context, branch_id=None):
    conditions = [
        GuestSession.tenant_id == ctx.tenant_id,
        GuestSession.started_at >= ctx.since,
        GuestSession.started_at < ctx.now,
    ]
    if branch_id is not None:
        conditions.append(GuestSession.branch_id == branch_id)
    return conditions


# ==========================================================================
# 1. Are returning guests worth more?
# ==========================================================================
@rule(
    key="returning_worth_more",
    title="What a returning guest is worth",
    audiences=(AUDIENCE_DIRECTOR,),
    requires=(SOURCE_QR_VISITS, SOURCE_ORDERS),
    settings=("returning_min_visits_each", "returning_min_difference_percent",
              "window_days"),
    decays=False,
)
def returning_worth_more(ctx: Context) -> list[Card]:
    """Spend per visit for guests seen before this window against guests seen
    for the first time in it.

    This is the number to look at before giving regulars a discount, and the
    card says plainly what it cannot prove: guests who come back are guests
    who already liked the place. They spend more BECAUSE they like it, not
    because they are regulars. So a discount aimed at creating regulars is not
    guaranteed to produce the same spending, and the only way to find out is
    to try it on half of them and compare.
    """
    min_each = int(ctx.setting("returning_min_visits_each"))
    min_difference = ctx.setting("returning_min_difference_percent") / 100.0
    window_days = int(ctx.setting("window_days"))

    # A guest first seen inside the window is new; anyone seen before is back.
    is_new = GuestProfile.first_seen_at >= ctx.since

    visit_rows = ctx.db.execute(
        select(is_new.label("is_new"), func.count(GuestSession.id).label("visits"))
        .select_from(GuestSession)
        .join(GuestProfile, GuestProfile.id == GuestSession.profile_id)
        .where(*_session_scope(ctx))
        .group_by("is_new")
    ).all()
    visits = {bool(r.is_new): int(r.visits) for r in visit_rows}

    money_rows = ctx.db.execute(
        select(
            is_new.label("is_new"),
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .select_from(Order)
        .join(GuestSession, GuestSession.id == Order.session_id)
        .join(GuestProfile, GuestProfile.id == GuestSession.profile_id)
        .where(*_session_scope(ctx), Order.status != OrderStatus.cancelled)
        .group_by("is_new")
    ).all()
    money = {bool(r.is_new): (float(r.revenue), int(r.orders)) for r in money_rows}

    new_visits, back_visits = visits.get(True, 0), visits.get(False, 0)
    if new_visits < min_each or back_visits < min_each:
        return []

    new_revenue, new_orders = money.get(True, (0.0, 0))
    back_revenue, back_orders = money.get(False, (0.0, 0))
    new_per_visit = new_revenue / new_visits
    back_per_visit = back_revenue / back_visits
    if new_per_visit <= 0:
        return []

    difference = (back_per_visit - new_per_visit) / new_per_visit
    if abs(difference) < min_difference:
        return []

    regulars_spend_more = difference > 0
    return [Card(
        subject_parts=("guest_value",),
        subject_label=f"{CURRENCY}{back_per_visit:.2f} vs {CURRENCY}{new_per_visit:.2f}",
        headline=(
            f"Returning guests spend {CURRENCY}{back_per_visit:.2f} a visit against "
            f"{CURRENCY}{new_per_visit:.2f} for first-timers."
        ),
        detail=(
            f"{back_visits} visits from guests you had seen before and "
            f"{new_visits} from new ones, over {window_days} days. Returning "
            f"guests are {abs(difference):.0%} "
            f"{'higher' if regulars_spend_more else 'lower'}. Bear in mind that "
            f"people who come back are people who already liked it, so this shows "
            f"what regulars are worth, not what a discount would create."
        ),
        suggestion=(
            "If you offer regulars a code, give it to half of those who qualify "
            "and compare the two halves after a month. That is the only way to "
            "tell a real effect from the fact that regulars already spend more."
            if regulars_spend_more else
            "Regulars are spending less per visit than newcomers, which is worth "
            "understanding before any loyalty offer: a discount would widen the "
            "gap rather than close it."
        ),
        evidence={
            "window_days": window_days,
            "returning": {"visits": back_visits, "orders": back_orders,
                          "revenue": round(back_revenue, 2),
                          "per_visit": round(back_per_visit, 2)},
            "new": {"visits": new_visits, "orders": new_orders,
                    "revenue": round(new_revenue, 2),
                    "per_visit": round(new_per_visit, 2)},
            "difference": round(difference, 3),
            "caveat": "self-selecting groups, not a controlled comparison",
        },
        impact=scaled(abs(difference), at_floor=min_difference,
                      at_full=min_difference * FULL_AT_MULTIPLE),
        data_points=min(new_visits, back_visits),
        data_needed=min_each,
        branch_id=None,
    )]


# ==========================================================================
# 2. Where the QR journey loses people
# ==========================================================================
# Each step has two wordings: a verb phrase for the journey line, and a noun
# phrase for "drop out between X and Y", which does not read with verbs.
FUNNEL_STEPS = (
    ("visits", "scanned the code", "the scan"),
    ("viewed", "looked at the menu", "the menu"),
    ("added", "put something in the basket", "the basket"),
    ("ordered", "placed an order", "the order"),
)


def _repair_funnel(counts: dict) -> tuple[dict, bool]:
    """Make the steps consistent, working backwards.

    A tracking event can be lost -- the guest goes offline, or closes the page
    mid-send -- which can leave a later step larger than an earlier one. That
    is impossible in reality: anyone who put something in a basket must have
    looked at the menu first. So each step is raised to at least the size of
    every step after it.

    This repairs upward only, never down, so a drop that survives is a genuine
    upper bound on the loss rather than an artefact of a missing event.

    Returns the repaired counts and whether anything had to be changed.
    """
    keys = [key for key, _verb, _noun in FUNNEL_STEPS]
    fixed = dict(counts)
    repaired = False
    running = 0
    for key in reversed(keys):
        if fixed[key] < running:
            fixed[key] = running
            repaired = True
        running = fixed[key]
    return fixed, repaired


@rule(
    key="funnel_drop",
    title="Where the QR journey loses people",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_QR_VISITS, SOURCE_ACTIVITY, SOURCE_ORDERS),
    settings=("funnel_min_visits", "funnel_min_drop_percent", "window_days"),
    decays=False,
)
def funnel_drop(ctx: Context) -> list[Card]:
    """The biggest fall between one step of the QR journey and the next.

    The steps are not strictly nested: a tracking event can be lost if the
    guest goes offline or closes the page mid-send, so a later step can
    occasionally come out larger than an earlier one. Those are skipped rather
    than reported as a negative drop.
    """
    min_visits = int(ctx.setting("funnel_min_visits"))
    min_drop = ctx.setting("funnel_min_drop_percent") / 100.0
    window_days = int(ctx.setting("window_days"))

    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        session_ids = select(GuestSession.id).where(*_session_scope(ctx, branch_id))

        visits = ctx.db.execute(
            select(func.count()).select_from(session_ids.subquery())
        ).scalar_one()
        if visits < min_visits:
            continue

        def sessions_with(*conditions) -> int:
            return ctx.db.execute(
                select(func.count(func.distinct(GuestActivity.session_id)))
                .where(GuestActivity.session_id.in_(session_ids), *conditions)
            ).scalar_one()

        counts = {
            "visits": visits,
            "viewed": sessions_with(GuestActivity.type.in_(["page_view", "item_view"])),
            "added": sessions_with(GuestActivity.type == "add_to_basket"),
            "ordered": ctx.db.execute(
                select(func.count(func.distinct(Order.session_id))).where(
                    Order.session_id.in_(session_ids),
                    Order.status != OrderStatus.cancelled,
                )
            ).scalar_one(),
        }

        raw_counts = dict(counts)
        counts, repaired = _repair_funnel(counts)

        worst = None
        for (from_key, _fv, from_text), (to_key, _tv, to_text) in zip(
            FUNNEL_STEPS, FUNNEL_STEPS[1:]
        ):
            before, after = counts[from_key], counts[to_key]
            if before <= 0:
                continue
            drop = (before - after) / before
            if worst is None or drop > worst["drop"]:
                worst = {
                    "from": from_key, "from_text": from_text,
                    "to": to_key, "to_text": to_text,
                    "before": before, "after": after, "drop": round(drop, 3),
                }
        if worst is None or worst["drop"] < min_drop:
            continue

        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""
        journey = " → ".join(f"{counts[k]} {t}" for k, _verb, t in FUNNEL_STEPS)

        cards.append(Card(
            subject_parts=("funnel",),      # one ongoing card per branch
            subject_label=f"{worst['from']} to {worst['to']}",
            headline=(
                f"{worst['drop']:.0%} of guests{where} drop out between "
                f"{worst['from_text']} and {worst['to_text']}."
            ),
            detail=(
                f"{worst['before']} got as far as {worst['from_text']} and only "
                f"{worst['after']} to {worst['to_text']}, over {window_days} days. "
                f"The whole journey: {journey}."
                + (
                    " Some tracking events did not arrive, so these are the lowest "
                    "numbers the data can support."
                    if repaired else ""
                )
            ),
            suggestion=_funnel_suggestion(worst["to"]),
            evidence={
                "window_days": window_days,
                "counts": counts,
                "counts_as_recorded": raw_counts,
                "repaired": repaired,
                "worst_step": worst,
                "threshold_drop": round(min_drop, 3),
                "note": (
                    "some tracking events were missing, so steps were raised to "
                    "the size of the steps after them"
                    if repaired else
                    "steps as recorded, no repair needed"
                ),
            },
            impact=scaled(worst["drop"], at_floor=min_drop, at_full=0.90),
            data_points=visits,
            data_needed=min_visits,
            branch_id=branch_id,
        ))
    return cards


def _funnel_suggestion(step: str) -> str:
    if step == "viewed":
        return (
            "They scan and then leave before the menu loads or makes sense. Check "
            "how long the menu takes on a phone on mobile data, and what the first "
            "screen actually shows."
        )
    if step == "added":
        return (
            "They read the menu and add nothing. Check the photos, the prices, and "
            "how obvious the add button is."
        )
    return (
        "They fill a basket and do not finish. Check the checkout for anything "
        "confusing or slow, and whether the order confirmation is clear."
    )


# ==========================================================================
# 3. How the branches compare
# ==========================================================================
@rule(
    key="branch_gap",
    title="A gap between the branches",
    audiences=(AUDIENCE_DIRECTOR,),
    requires=(SOURCE_QR_VISITS, SOURCE_ORDERS),
    settings=("branch_gap_min_difference_percent", "returning_min_visits_each",
              "window_days"),
    decays=False,
)
def branch_gap(ctx: Context) -> list[Card]:
    """Revenue per QR visit, branch against branch.

    Directors only, and worded as something to look into rather than a verdict.
    With two branches a difference is at least as likely to come from the
    neighbourhood, the size of the room or the day of the week people visit as
    from anything the staff did.

    The two branch ids are sorted before the fingerprint is built, so the
    comparison is one card whichever branch comes out ahead.
    """
    min_difference = ctx.setting("branch_gap_min_difference_percent") / 100.0
    min_visits = int(ctx.setting("returning_min_visits_each"))
    window_days = int(ctx.setting("window_days"))

    if len(ctx.branch_ids) < 2:
        return []

    visit_rows = ctx.db.execute(
        select(GuestSession.branch_id, func.count(GuestSession.id).label("visits"))
        .where(*_session_scope(ctx))
        .group_by(GuestSession.branch_id)
    ).all()
    visits = {r.branch_id: int(r.visits) for r in visit_rows}

    money_rows = ctx.db.execute(
        select(
            GuestSession.branch_id,
            func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
        )
        .select_from(Order)
        .join(GuestSession, GuestSession.id == Order.session_id)
        .where(*_session_scope(ctx), Order.status != OrderStatus.cancelled)
        .group_by(GuestSession.branch_id)
    ).all()
    revenue = {r.branch_id: float(r.revenue) for r in money_rows}

    names = branch_names(ctx)
    scored = []
    for branch_id, visit_count in visits.items():
        if visit_count < min_visits:
            continue
        scored.append({
            "branch_id": str(branch_id),
            "branch": names.get(branch_id, "a branch"),
            "visits": visit_count,
            "revenue": round(revenue.get(branch_id, 0.0), 2),
            "per_visit": revenue.get(branch_id, 0.0) / visit_count,
        })
    if len(scored) < 2:
        return []

    scored.sort(key=lambda b: b["per_visit"], reverse=True)
    ahead, behind = scored[0], scored[-1]
    if behind["per_visit"] <= 0:
        return []
    difference = (ahead["per_visit"] - behind["per_visit"]) / behind["per_visit"]
    if difference < min_difference:
        return []

    gap = ahead["per_visit"] - behind["per_visit"]
    # Sorted, so the pair makes one card whichever way round it comes out.
    pair = tuple(sorted([ahead["branch_id"], behind["branch_id"]]))

    return [Card(
        subject_parts=("branches",) + pair,
        subject_label=f"{ahead['branch']} vs {behind['branch']}",
        headline=(
            f"{ahead['branch']} takes {CURRENCY}{gap:.2f} more per QR visit than "
            f"{behind['branch']}."
        ),
        detail=(
            f"{CURRENCY}{ahead['per_visit']:.2f} a visit across {ahead['visits']} "
            f"visits, against {CURRENCY}{behind['per_visit']:.2f} across "
            f"{behind['visits']}, over {window_days} days. With two branches this "
            f"is as likely to be the area, the size of the room or who walks in as "
            f"anything the teams are doing differently."
        ),
        suggestion=(
            f"Worth a look rather than a conclusion: compare what the two branches "
            f"sell, their busiest hours and their average order, before reading "
            f"anything into it."
        ),
        evidence={
            "window_days": window_days,
            "ahead": ahead,
            "behind": behind,
            "difference": round(difference, 3),
            "gap_per_visit": round(gap, 2),
            "caveat": "two branches, so location and footfall are not controlled for",
        },
        impact=scaled(difference, at_floor=min_difference,
                      at_full=min_difference * FULL_AT_MULTIPLE),
        data_points=min(ahead["visits"], behind["visits"]),
        data_needed=min_visits,
        branch_id=None,
    )]


# ==========================================================================
# 4. Table codes nobody scans
# ==========================================================================
@rule(
    key="table_underused",
    title="Table codes nobody scans",
    audiences=(AUDIENCE_DIRECTOR, AUDIENCE_MANAGER),
    requires=(SOURCE_QR_VISITS,),
    settings=("table_underused_max_percent_of_median", "table_underused_min_tables",
              "window_days"),
    decays=False,
)
def table_underused(ctx: Context) -> list[Card]:
    """Tables whose QR code is scanned far less than a typical table's.

    One card per branch listing the tables, not one card per table: several
    barely-used codes are usually one problem -- a missing, damaged or badly
    placed sign -- and a card each would bury everything else on the page.

    Compared against the MEDIAN rather than the average, because a couple of
    very popular tables would drag an average up and make everything else look
    neglected.
    """
    max_share = ctx.setting("table_underused_max_percent_of_median") / 100.0
    min_tables = int(ctx.setting("table_underused_min_tables"))
    window_days = int(ctx.setting("window_days"))

    names = branch_names(ctx)
    many_branches = len(ctx.branch_ids) > 1
    cards: list[Card] = []

    for branch_id in ctx.branch_ids:
        # Every table at this branch, including ones with no scans at all --
        # those are the whole point, and they never appear in guest_sessions.
        table_rows = ctx.db.execute(
            select(Table.id, Table.number)
            .where(Table.branch_id == branch_id)
        ).all()
        if len(table_rows) < min_tables:
            continue

        scan_rows = ctx.db.execute(
            select(GuestSession.table_id, func.count(GuestSession.id).label("scans"))
            .where(*_session_scope(ctx, branch_id), GuestSession.table_id.is_not(None))
            .group_by(GuestSession.table_id)
        ).all()
        scans = {r.table_id: int(r.scans) for r in scan_rows}

        table_rows = [(table_id, f"Table {number}") for table_id, number in table_rows]
        counts = [scans.get(table_id, 0) for table_id, _name in table_rows]
        typical = median(counts)
        if typical <= 0:
            continue                        # nothing is being scanned at all

        cutoff = typical * max_share
        quiet = sorted(
            (
                {"table_id": str(table_id), "table": name,
                 "scans": scans.get(table_id, 0)}
                for table_id, name in table_rows
                if scans.get(table_id, 0) <= cutoff
            ),
            key=lambda t: t["scans"],
        )
        if not quiet:
            continue

        where = f" at {names[branch_id]}" if many_branches and branch_id in names else ""
        listed = quiet[:MAX_TABLES_NAMED]
        table_text = ", ".join(t["table"] for t in listed)
        more = len(quiet) - len(listed)
        if more > 0:
            table_text += f" and {more} more"
        share_of_tables = len(quiet) / len(table_rows)

        cards.append(Card(
            subject_parts=("table_use",),   # one ongoing card per branch
            subject_label=table_text,
            headline=(
                f"{len(quiet)} of {len(table_rows)} table codes{where} are barely "
                f"being scanned."
            ),
            detail=(
                f"{table_text}. A typical table at this branch was scanned "
                f"{typical:.0f} times over {window_days} days; these had "
                f"{listed[0]['scans']} to {listed[-1]['scans']}. Compared against "
                f"the middle table rather than the average, so a couple of busy "
                f"tables cannot skew it."
            ),
            suggestion=(
                "Walk the floor and check those tables: a missing or damaged code, "
                "a sign face down, or a spot where nobody notices it."
            ),
            evidence={
                "window_days": window_days,
                "median_scans": typical,
                "cutoff": round(cutoff, 1),
                "tables_total": len(table_rows),
                "tables_quiet": len(quiet),
                "quiet": quiet[:20],
            },
            impact=scaled(share_of_tables, at_floor=0.05, at_full=0.40),
            data_points=len(table_rows),
            data_needed=min_tables,
            branch_id=branch_id,
        ))
    return cards