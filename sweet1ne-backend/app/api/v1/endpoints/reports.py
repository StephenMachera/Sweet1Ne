from datetime import date, datetime, time, timezone, timedelta
from sqlalchemy import func, select, or_,cast,Float
from sqlalchemy.orm import Session
from dateutil.relativedelta import relativedelta
import uuid

from fastapi import APIRouter, Depends, HTTPException

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
