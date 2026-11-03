from datetime import date, datetime, time, timezone, timedelta
from sqlalchemy import func, select, or_,cast,Float
from sqlalchemy.orm import Session
from dateutil.relativedelta import relativedelta
from zoneinfo import ZoneInfo
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.staff import Staff
from app.models.table import Table
from app.models.main_menu_category import MainCategory
from app.models.sub_menu_category import SubCategory
# ---- ADJUST: paths of the guest models we created earlier ----
from app.models.guest_profile import GuestProfile
from app.models.guest_session import GuestSession
# --------------------------------------------------------------
from app.schemas.reports import (
    BranchBreakdown,
    NamedTotal,
    ReportOut,
    StaffActivity,
    TrendPoint,
    BranchStats,
    TopItem,
    OverviewOut
)

router = APIRouter()


LIVE_STATUSES = [OrderStatus.pending, OrderStatus.in_progress]

def _today_start() -> datetime:
    return datetime.combine(date.today(), time.min, tzinfo=timezone.utc)


@router.get("/overview", response_model=OverviewOut)
def overview(
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    today_start = _today_start()

    def scoped(statement):
        """Every query here walks Order -> Table -> Branch for tenant/branch
        scoping, since Order has no tenant_id of its own."""
        statement = (
            statement.join(Table, Order.table_id == Table.id)
            .join(Branch, Table.branch_id == Branch.id)
            .where(Branch.tenant_id == staff.tenant_id)
            .where(Order.created_at >= today_start)
            .where(Order.status != OrderStatus.cancelled)
        )
        if staff.branch_id is not None:
            statement = statement.where(Table.branch_id == staff.branch_id)

        if not (staff.is_super_admin or "view_all_orders" in staff.permissions):
            statement = statement.where(
                or_(
                    Order.placed_by_staff_id == staff.user_id,
                    Order.placed_by_staff_id.is_(None),
                )
            )

        return statement

    # --- Company-wide totals ---
    totals = db.execute(
        scoped(select(func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0)))
    ).one()
    orders_today, revenue_today = totals[0], float(totals[1])

    live_orders = db.execute(
        scoped(select(func.count(Order.id))).where(Order.status.in_(LIVE_STATUSES))
    ).scalar_one()

    average_order_value = revenue_today / orders_today if orders_today else 0.0

    # --- Per-branch breakdown ---
    branch_rows = db.execute(
        scoped(
            select(
                Branch.id,
                Branch.name,
                func.count(Order.id).label("orders"),
                func.coalesce(func.sum(Order.total_amount), 0).label("revenue"),
            )
        ).group_by(Branch.id, Branch.name)
    ).all()

    live_by_branch = dict(
        db.execute(
            scoped(select(Branch.id, func.count(Order.id)))
            .where(Order.status.in_(LIVE_STATUSES))
            .group_by(Branch.id)
        ).all()
    )

    by_branch = [
        BranchStats(
            branch_id=str(row.id),
            branch_name=row.name,
            orders_today=row.orders,
            revenue_today=float(row.revenue),
            live_orders=live_by_branch.get(row.id, 0),
            average_order_value=float(row.revenue) / row.orders if row.orders else 0.0,
        )
        for row in branch_rows
    ]

    # --- Top-selling items today ---
    top_rows = db.execute(
        scoped(
            select(
                MenuItem.id,
                MenuItem.title,
                func.sum(OrderItem.quantity).label("total_quantity"),
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        )
        .group_by(MenuItem.id, MenuItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(5)
    ).all()

    top_items = [
        TopItem(menu_item_id=str(r.id), title=r.title, total_quantity=int(r.total_quantity))
        for r in top_rows
    ]

    return OverviewOut(
        orders_today=orders_today,
        revenue_today=revenue_today,
        live_orders=live_orders,
        average_order_value=average_order_value,
        by_branch=by_branch,
        top_items=top_items,
    )


PERIODS = ("daily", "weekly", "monthly", "yearly")


def _period_bounds(period: str) -> tuple[datetime, datetime, datetime, str, str]:
    """Returns (start, end, previous_start, trunc_unit, label).

    The previous window is the same length immediately before, so a
    comparison is like-for-like.
    """
    now = datetime.now(timezone.utc)
    today = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)

    if period == "daily":
        start, end = today, today + timedelta(days=1)
        return start, end, start - timedelta(days=1), "hour", date.today().strftime("%A %d %B")

    if period == "weekly":
        start = today - timedelta(days=6)
        return start, today + timedelta(days=1), start - timedelta(days=7), "day", "Last 7 days"

    if period == "monthly":
        start = today.replace(day=1)
        prev = start - relativedelta(months=1)
        return start, today + timedelta(days=1), prev, "day", start.strftime("%B %Y")

    # yearly
    start = (today - relativedelta(months=11)).replace(day=1)
    prev = start - relativedelta(months=12)
    return start, today + timedelta(days=1), prev, "month", "Last 12 months"


@router.get("/report", response_model=ReportOut)
def report(
    period: str = "weekly",
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    if period not in PERIODS:
        raise HTTPException(status_code=400, detail="Unknown period")

    start, end, prev_start, trunc, range_label = _period_bounds(period)

    def scoped(statement, since: datetime, until: datetime):
        """Every query walks Order -> Table -> Branch, since Order carries no
        tenant or branch of its own."""
        statement = (
            statement.join(Table, Order.table_id == Table.id)
            .join(Branch, Table.branch_id == Branch.id)
            .where(
                Branch.tenant_id == staff.tenant_id,
                Order.status != OrderStatus.cancelled,
                Order.created_at >= since,
                Order.created_at < until,
            )
        )
        if staff.branch_id is not None:
            statement = statement.where(Table.branch_id == staff.branch_id)
        elif branch_id is not None:
            statement = statement.where(Table.branch_id == branch_id)
        return statement

    # --- Headline totals, this period and the last ---
    def totals(since: datetime, until: datetime) -> tuple[int, float]:
        row = db.execute(
            scoped(
                select(func.count(Order.id), func.coalesce(func.sum(Order.total_amount), 0)),
                since,
                until,
            )
        ).one()
        return row[0], float(row[1])

    orders_count, revenue = totals(start, end)
    prev_orders, prev_revenue = totals(prev_start, start)
    average = revenue / orders_count if orders_count else 0.0

    # --- Trend ---
    bucket = func.date_trunc(trunc, Order.created_at)
    trend_rows = db.execute(
        scoped(
            select(
                bucket.label("bucket"),
                func.coalesce(func.sum(Order.total_amount), 0),
                func.count(Order.id),
            ),
            start,
            end,
        )
        .group_by("bucket")
        .order_by("bucket")
    ).all()

    def label_for(moment: datetime) -> str:
        if trunc == "hour":
            return moment.strftime("%H:00")
        if trunc == "month":
            return moment.strftime("%b")
        return moment.strftime("%d %b")

    trend = [
        TrendPoint(label=label_for(b), revenue=float(rev), orders=count)
        for b, rev, count in trend_rows
    ]

    # --- Per branch (director only — a manager has just their own) ---
    branch_rows = db.execute(
        scoped(
            select(
                Branch.id,
                Branch.name,
                func.coalesce(func.sum(Order.total_amount), 0),
                func.count(Order.id),
            ),
            start,
            end,
        )
        .group_by(Branch.id, Branch.name)
        .order_by(func.sum(Order.total_amount).desc())
    ).all()

    by_branch = [
        BranchBreakdown(
            branch_id=str(bid),
            branch_name=name,
            revenue=float(rev),
            orders=count,
            average_order_value=float(rev) / count if count else 0.0,
        )
        for bid, name, rev, count in branch_rows
    ]

    # --- By category ---
    category_rows = db.execute(
        scoped(
            select(
                MainCategory.id,
                MainCategory.name,
                func.coalesce(func.sum(OrderItem.total_price), 0),
                func.coalesce(func.sum(OrderItem.quantity), 0),
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
            .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
            .join(MainCategory, SubCategory.main_category_id == MainCategory.id),
            start,
            end,
        )
        .group_by(MainCategory.id, MainCategory.name)
        .order_by(func.sum(OrderItem.total_price).desc())
    ).all()

    by_category = [
        NamedTotal(id=str(cid), name=name, revenue=float(rev), quantity=int(qty))
        for cid, name, rev, qty in category_rows
    ]

    # --- Item rankings ---
    item_rows = db.execute(
        scoped(
            select(
                MenuItem.id,
                MenuItem.title,
                func.coalesce(func.sum(OrderItem.total_price), 0),
                func.coalesce(func.sum(OrderItem.quantity), 0),
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(MenuItem, OrderItem.menu_item_id == MenuItem.id),
            start,
            end,
        )
        .group_by(MenuItem.id, MenuItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
    ).all()

    ranked = [
        NamedTotal(id=str(iid), name=title, revenue=float(rev), quantity=int(qty))
        for iid, title, rev, qty in item_rows
    ]
    top_items = ranked[:8]
    # Slowest movers — only meaningful once there's more than a handful.
    bottom_items = list(reversed(ranked[-8:])) if len(ranked) > 8 else []

    # --- By hour (across the whole period, not just today) ---
    hour_bucket = func.extract("hour", Order.created_at)
    hour_rows = db.execute(
        scoped(
            select(
                hour_bucket.label("hour"),
                func.coalesce(func.sum(Order.total_amount), 0),
                func.count(Order.id),
            ),
            start,
            end,
        )
        .group_by("hour")
        .order_by("hour")
    ).all()

    by_hour = [
        TrendPoint(label=f"{int(hour):02d}:00", revenue=float(rev), orders=count)
        for hour, rev, count in hour_rows
    ]

    # --- Staff activity ---
    staff_rows = db.execute(
        scoped(
            select(
                Order.placed_by_staff_id,
                Staff.full_name,
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), 0),
            ).outerjoin(Staff, Order.placed_by_staff_id == Staff.id),
            start,
            end,
        )
        .group_by(Order.placed_by_staff_id, Staff.full_name)
        .order_by(func.count(Order.id).desc())
    ).all()

    by_staff = [
        StaffActivity(
            staff_id=str(sid) if sid else None,
            # Unattributed orders came straight from a table's QR code.
            name=name or "Customer (QR)",
            orders=count,
            revenue=float(rev),
        )
        for sid, name, count, rev in staff_rows
    ]

    return ReportOut(
        period=period,
        range_label=range_label,
        revenue=revenue,
        orders=orders_count,
        average_order_value=average,
        previous_revenue=prev_revenue,
        previous_orders=prev_orders,
        trend=trend,
        by_branch=by_branch,
        by_category=by_category,
        top_items=top_items,
        bottom_items=bottom_items,
        by_hour=by_hour,
        by_staff=by_staff,
    )


# =====================================================================
# REVENUE TAB (new). Everything above this line is your original code.
#
# Rules used by every endpoint below:
#   - "Revenue" = Order.total_amount of orders that are not cancelled.
#     That includes orders still pending or in progress, so it is the value
#     of orders placed, not money collected.
#   - Days and hours are London time. The old /report endpoint uses UTC.
#   - A branch user only ever sees their own branch.
#   - Responses are plain dicts. Add pydantic schemas later if you want them.
# =====================================================================
LONDON = "Europe/London"
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
TIME_BLOCKS = [
    (12, 15, "12 to 3pm"),
    (15, 18, "3 to 6pm"),
    (18, 21, "6 to 9pm"),
    (21, 24, "9pm to 12"),
]


def _london(column):
    """Convert a stored UTC time to London time inside the query."""
    return func.timezone(LONDON, column)


def _revenue_window(days: int):
    """(now, start of this window, start of the window before it)."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    return now, since, since - timedelta(days=days)


def _rev_sum():
    return func.coalesce(func.sum(Order.total_amount), 0)


def _revenue_scoped(statement, staff: CurrentStaff, branch_id, since, until, cancelled: bool = False):
    """Same Order -> Table -> Branch scoping as /report, with an option to
    look at cancelled orders instead of excluding them."""
    statement = (
        statement.join(Table, Order.table_id == Table.id)
        .join(Branch, Table.branch_id == Branch.id)
        .where(
            Branch.tenant_id == staff.tenant_id,
            Order.created_at >= since,
            Order.created_at < until,
            (Order.status == OrderStatus.cancelled) if cancelled else (Order.status != OrderStatus.cancelled),
        )
    )
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        statement = statement.where(Table.branch_id == wanted)
    return statement


def _session_scope(staff: CurrentStaff, branch_id, since, until):
    """WHERE conditions for QR visits (guest sessions) in a window."""
    scope = [
        GuestSession.tenant_id == staff.tenant_id,
        GuestSession.started_at >= since,
        GuestSession.started_at < until,
    ]
    wanted = staff.branch_id or branch_id
    if wanted is not None:
        scope.append(GuestSession.branch_id == wanted)
    return scope


def _central_only(staff: CurrentStaff):
    if staff.branch_id is not None:
        raise HTTPException(status_code=403, detail="Central staff only.")


def _share(part, whole):
    return round(part / whole, 3) if whole else None


# --------------------------------------------------------------- summary
@router.get("/revenue/summary")
def revenue_summary(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """The top cards: revenue, orders, average order, the previous period,
    cancelled orders, and what a QR visit is worth."""
    now, since, prev_since = _revenue_window(days)

    def totals(start, end, cancelled=False):
        count, total = db.execute(
            _revenue_scoped(
                select(func.count(Order.id), _rev_sum()), staff, branch_id, start, end, cancelled
            )
        ).one()
        return count, float(total)

    orders, revenue = totals(since, now)
    prev_orders, prev_revenue = totals(prev_since, since)
    cancelled_orders, cancelled_value = totals(since, now, cancelled=True)

    # QR visits, and the revenue of orders that belong to a visit.
    visits = db.execute(
        select(func.count(GuestSession.id)).where(*_session_scope(staff, branch_id, since, now))
    ).scalar_one()

    linked_orders, linked_revenue = db.execute(
        _revenue_scoped(
            select(func.count(Order.id), _rev_sum()), staff, branch_id, since, now
        ).where(Order.session_id.is_not(None))
    ).one()
    linked_revenue = float(linked_revenue)

    # Of that, revenue from guests who had been seen before this window.
    returning_revenue = float(
        db.execute(
            _revenue_scoped(
                select(_rev_sum()).select_from(Order), staff, branch_id, since, now
            )
            .join(GuestSession, GuestSession.id == Order.session_id)
            .join(GuestProfile, GuestProfile.id == GuestSession.profile_id)
            .where(GuestProfile.first_seen_at < since)
        ).scalar_one()
    )

    return {
        "days": days,
        "revenue": revenue,
        "previous_revenue": prev_revenue,
        "orders": orders,
        "previous_orders": prev_orders,
        "average_order_value": revenue / orders if orders else None,
        "previous_average_order_value": prev_revenue / prev_orders if prev_orders else None,
        "cancelled_orders": cancelled_orders,
        "cancelled_value": cancelled_value,
        # Share of all orders (kept + cancelled) that were cancelled.
        "cancelled_share": _share(cancelled_orders, orders + cancelled_orders),
        "qr_visits": visits,
        "qr_linked_orders": linked_orders,
        "revenue_per_qr_visit": round(linked_revenue / visits, 2) if visits else None,
        # Share of visit-linked revenue that came from returning guests.
        "returning_guest_share": _share(returning_revenue, linked_revenue),
    }


# ----------------------------------------------------------------- trend
@router.get("/revenue/trend")
def revenue_trend(
    days: int = Query(30, ge=7, le=90),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Revenue for each London day, with the same day of the previous window."""
    london = ZoneInfo(LONDON)
    today = datetime.now(london).date()
    day_list = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    start = datetime.combine(day_list[0], time.min, tzinfo=london)
    prev_start = datetime.combine(day_list[0] - timedelta(days=days), time.min, tzinfo=london)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=london)

    day_col = func.date(_london(Order.created_at))
    rows = db.execute(
        _revenue_scoped(
            select(day_col.label("day"), _rev_sum(), func.count(Order.id)),
            staff, branch_id, prev_start, end,
        ).group_by("day")
    ).all()
    by_day = {d: (float(rev), n) for d, rev, n in rows}

    items = []
    for d in day_list:
        rev, n = by_day.get(d, (0.0, 0))
        prev_rev, _ = by_day.get(d - timedelta(days=days), (0.0, 0))
        items.append({"date": d.isoformat(), "revenue": rev, "orders": n, "previous_revenue": prev_rev})

    with_money = [i for i in items if i["revenue"] > 0]
    best = max(with_money, key=lambda i: i["revenue"]) if with_money else None
    slowest = min(with_money, key=lambda i: i["revenue"]) if with_money else None
    return {"days": days, "items": items, "best_day": best, "slowest_day": slowest}


# ------------------------------------------------------------- by branch
@router.get("/revenue/by-branch")
def revenue_by_branch(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _revenue_window(days)
    rows = db.execute(
        _revenue_scoped(
            select(Branch.id, Branch.name, _rev_sum(), func.count(Order.id)).select_from(Order),
            staff, branch_id, since, now,
        )
        .group_by(Branch.id, Branch.name)
        .order_by(func.sum(Order.total_amount).desc())
    ).all()
    total = sum(float(r[2]) for r in rows)
    return {
        "days": days,
        "items": [
            {
                "branch_id": str(bid),
                "branch": name,
                "revenue": float(rev),
                "orders": n,
                "average_order_value": float(rev) / n if n else None,
                "share": _share(float(rev), total),
            }
            for bid, name, rev, n in rows
        ],
    }


# --------------------------------------------------------------- heatmap
@router.get("/revenue/heatmap")
def revenue_heatmap(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Revenue by weekday (Monday first) and time block, London time."""
    now, since, _ = _revenue_window(days)
    hour = func.extract("hour", _london(Order.created_at))
    dow = func.extract("dow", _london(Order.created_at))      # Postgres: 0 = Sunday
    rows = db.execute(
        _revenue_scoped(
            select(dow.label("dow"), hour.label("hour"), _rev_sum()),
            staff, branch_id, since, now,
        ).group_by("dow", "hour")
    ).all()

    grid = [[0.0] * len(TIME_BLOCKS) for _ in WEEKDAYS]
    other = [0.0] * len(WEEKDAYS)               # revenue outside the four blocks
    for d, h, rev in rows:
        row = (int(d) - 1) % 7                  # Monday first
        h = int(h)
        for col, (a, b, _label) in enumerate(TIME_BLOCKS):
            if a <= h < b:
                grid[row][col] += float(rev)
                break
        else:
            other[row] += float(rev)

    best = None
    for r, day in enumerate(WEEKDAYS):
        for c, (_a, _b, label) in enumerate(TIME_BLOCKS):
            if grid[r][c] > 0 and (best is None or grid[r][c] > best["revenue"]):
                best = {"day": day, "block": label, "revenue": grid[r][c]}

    return {
        "days": days,
        "blocks": [label for _a, _b, label in TIME_BLOCKS],
        "rows": [
            {"day": day, "cells": grid[r], "other": other[r]} for r, day in enumerate(WEEKDAYS)
        ],
        "best": best,
    }


# ------------------------------------------------------------ categories
@router.get("/revenue/categories")
def revenue_categories(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _revenue_window(days)
    rows = db.execute(
        _revenue_scoped(
            select(
                MainCategory.id,
                MainCategory.name,
                func.coalesce(func.sum(OrderItem.total_price), 0),
                func.coalesce(func.sum(OrderItem.quantity), 0),
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
            .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
            .join(MainCategory, SubCategory.main_category_id == MainCategory.id),
            staff, branch_id, since, now,
        )
        .group_by(MainCategory.id, MainCategory.name)
        .order_by(func.sum(OrderItem.total_price).desc())
    ).all()
    total = sum(float(r[2]) for r in rows)
    return {
        "days": days,
        "items": [
            {"id": str(cid), "name": name, "revenue": float(rev), "sold": int(qty), "share": _share(float(rev), total)}
            for cid, name, rev, qty in rows
        ],
    }


# ----------------------------------------------------------------- items
@router.get("/revenue/items")
def revenue_items(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Items ranked by money earned (the old report ranks by quantity)."""
    now, since, _ = _revenue_window(days)
    rows = db.execute(
        _revenue_scoped(
            select(
                MenuItem.id,
                MenuItem.title,
                func.coalesce(func.sum(OrderItem.total_price), 0),
                func.coalesce(func.sum(OrderItem.quantity), 0),
            )
            .select_from(Order)
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(MenuItem, OrderItem.menu_item_id == MenuItem.id),
            staff, branch_id, since, now,
        )
        .group_by(MenuItem.id, MenuItem.title)
        .order_by(func.sum(OrderItem.total_price).desc())
        .limit(limit)
    ).all()
    return {
        "days": days,
        "items": [
            {
                "id": str(iid),
                "name": title,
                "sold": int(qty),
                "revenue": float(rev),
                "average_price": float(rev) / int(qty) if qty else None,
            }
            for iid, title, rev, qty in rows
        ],
    }


# -------------------------------------------------------------- channels
@router.get("/revenue/channels")
def revenue_channels(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """QR menu orders (no staff member attached) against orders placed by staff."""
    now, since, _ = _revenue_window(days)
    is_qr = Order.placed_by_staff_id.is_(None)
    rows = db.execute(
        _revenue_scoped(
            select(is_qr.label("qr"), func.count(Order.id), _rev_sum()),
            staff, branch_id, since, now,
        ).group_by("qr")
    ).all()
    found = {bool(qr): (n, float(rev)) for qr, n, rev in rows}
    qr_orders, qr_revenue = found.get(True, (0, 0.0))
    st_orders, st_revenue = found.get(False, (0, 0.0))
    total = qr_revenue + st_revenue

    def row(name, n, rev):
        return {
            "name": name,
            "orders": n,
            "revenue": rev,
            "share": _share(rev, total),
            "average_order_value": rev / n if n else None,
        }

    return {
        "days": days,
        "items": [row("QR menu", qr_orders, qr_revenue), row("Placed by staff", st_orders, st_revenue)],
    }


# ---------------------------------------------------------------- guests
@router.get("/revenue/guests")
def revenue_guests(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """What a QR visit is worth: new guests (first seen in this window)
    against returning guests (seen before). Guests are counted by email."""
    now, since, _ = _revenue_window(days)
    is_new = GuestProfile.first_seen_at >= since

    visit_rows = db.execute(
        select(is_new.label("is_new"), func.count(GuestSession.id))
        .select_from(GuestSession)
        .join(GuestProfile, GuestProfile.id == GuestSession.profile_id)
        .where(*_session_scope(staff, branch_id, since, now))
        .group_by("is_new")
    ).all()
    visits = {bool(flag): n for flag, n in visit_rows}

    revenue_rows = db.execute(
        _revenue_scoped(
            select(is_new.label("is_new"), _rev_sum(), func.count(Order.id))
            .select_from(Order)
            .join(GuestSession, GuestSession.id == Order.session_id)
            .join(GuestProfile, GuestProfile.id == GuestSession.profile_id),
            staff, branch_id, since, now,
        ).group_by("is_new")
    ).all()
    revenue = {bool(flag): (float(rev), n) for flag, rev, n in revenue_rows}

    def row(name, flag):
        v = visits.get(flag, 0)
        rev, n = revenue.get(flag, (0.0, 0))
        return {
            "name": name,
            "visits": v,
            "orders": n,
            "revenue": rev,
            "per_visit": round(rev / v, 2) if v else None,
        }

    return {"days": days, "items": [row("New guests", True), row("Returning guests", False)]}


# ------------------------------------------------------------ promotions
@router.get("/revenue/promotions")
def revenue_promotions(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Average order with a promo code against without one.
    Compares spending only: the discount amount is not stored on the order."""
    now, since, _ = _revenue_window(days)
    has_code = (Order.promo_code.is_not(None)) & (Order.promo_code != "")

    without_avg = db.execute(
        _revenue_scoped(select(func.avg(Order.total_amount)), staff, branch_id, since, now).where(~has_code)
    ).scalar_one()
    without_avg = float(without_avg) if without_avg is not None else None

    rows = db.execute(
        _revenue_scoped(
            select(Order.promo_code, func.count(Order.id), func.avg(Order.total_amount)),
            staff, branch_id, since, now,
        )
        .where(has_code)
        .group_by(Order.promo_code)
        .order_by(func.count(Order.id).desc())
        .limit(limit)
    ).all()

    return {
        "days": days,
        "average_without_code": without_avg,
        "items": [
            {
                "code": code,
                "used": n,
                "average_with_code": float(avg),
                "difference": (float(avg) / without_avg - 1) if without_avg else None,
            }
            for code, n, avg in rows
        ],
    }


# ---------------------------------------------------------------- tables
@router.get("/revenue/tables")
def revenue_tables(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    now, since, _ = _revenue_window(days)
    rows = db.execute(
        _revenue_scoped(
            select(Table.id, Table.number, Branch.name, func.count(Order.id), _rev_sum()).select_from(Order),
            staff, branch_id, since, now,
        )
        .group_by(Table.id, Table.number, Branch.name)
        .order_by(func.sum(Order.total_amount).desc())
        .limit(limit)
    ).all()
    return {
        "days": days,
        "items": [
            {"table_id": str(tid), "table": f"Table {number}", "branch": bname, "orders": n, "revenue": float(rev)}
            for tid, number, bname, n, rev in rows
        ],
    }


# ----------------------------------------------------------------- staff
@router.get("/revenue/staff")
def revenue_staff(
    days: int = Query(30, ge=1, le=365),
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    """Orders placed by staff for guests. QR orders are not in this list.
    Central staff only: sales by person can be sensitive."""
    _central_only(staff)
    now, since, _ = _revenue_window(days)
    rows = db.execute(
        _revenue_scoped(
            select(Staff.id, Staff.full_name, func.count(Order.id), _rev_sum())
            .select_from(Order)
            .join(Staff, Order.placed_by_staff_id == Staff.id),
            staff, branch_id, since, now,
        )
        .group_by(Staff.id, Staff.full_name)
        .order_by(func.sum(Order.total_amount).desc())
    ).all()
    return {
        "days": days,
        "items": [
            {
                "staff_id": str(sid),
                "name": name,
                "orders": n,
                "revenue": float(rev),
                "average_order_value": float(rev) / n if n else None,
            }
            for sid, name, n, rev in rows
        ],
    }