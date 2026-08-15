from datetime import date, datetime, time, timezone
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from app.schemas.reports import BranchStats, TopItem, OverviewOut

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table import Table

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
