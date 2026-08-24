from datetime import date, datetime, timezone, time
from decimal import Decimal
from uuid import UUID
import uuid

#---dependencies---
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

#-----dependencies---
from app.core.security import CurrentStaff, get_current_staff, require_permission
from app.db.session import get_db

# ---models---
from app.models.branch import Branch
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table import Table
from app.models.staff import Staff

# ---schemas---
from app.schemas.orders import OrderItemIn, OrderOut, StaffOrderCreate, OrderUpdate, OrderItemsAdd

#---services---
from app.services.promos import price_for, category_map, active_promos
router = APIRouter()

from app.api.v1.endpoints.reports import _period_bounds  # or move it to a shared module

PERIODS = ("daily", "weekly", "monthly", "yearly", "all")
MAX_ORDERS = 200


@router.get("", response_model=list[OrderOut])
def list_orders(
    period: str = "daily",
    status: OrderStatus | None = None,
    branch_id: uuid.UUID | None = None,
    q: str | None = None,
    order_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("view_orders")),
    db: Session = Depends(get_db),
):
    if period not in PERIODS:
        raise HTTPException(status_code=400, detail="Unknown period")

    statement = (
        select(Order)
        .join(Table, Order.table_id == Table.id)
        .join(Branch, Table.branch_id == Branch.id)
        .where(Branch.tenant_id == staff.tenant_id)
    )
    if staff.branch_id is not None:
        statement = statement.where(Table.branch_id == staff.branch_id)
    elif branch_id is not None:
        statement = statement.where(Table.branch_id == branch_id)

    # A direct id lookup ignores every other filter — it's how a waiter
    # reaches a customer's QR order regardless of when it was placed.
    if order_id is not None:
        return db.execute(statement.where(Order.id == order_id)).scalars().all()

    sees_everything = staff.is_super_admin or "view_all_orders" in staff.permissions
    if not sees_everything:
        statement = statement.where(
            or_(
                Order.placed_by_staff_id == staff.user_id,
                Order.placed_by_staff_id.is_(None),
            )
        )

    if period != "all":
        start, end, _prev, _trunc, _label = _period_bounds(period)
        statement = statement.where(Order.created_at >= start, Order.created_at < end)

    if status is not None:
        statement = statement.where(Order.status == status)

    if q is not None:
        statement = statement.where(Order.special_request.ilike(f"%{q}%"))

    statement = statement.order_by(Order.created_at.desc()).limit(MAX_ORDERS)
    return db.execute(statement).scalars().all()

@router.get("/reports/top-items")
def top_ordered_items(
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 10,
    staff: CurrentStaff = Depends(require_permission("access_reports")),
    db: Session = Depends(get_db),
):
    statement = (
        select(
            MenuItem.id,
            MenuItem.title,
            func.sum(OrderItem.quantity).label("total_quantity"),
        )
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, OrderItem.order_id == Order.id)
        .join(Table, Order.table_id == Table.id)
        .join(Branch, Table.branch_id == Branch.id)
        .where(Branch.tenant_id == staff.tenant_id)
        .group_by(MenuItem.id, MenuItem.title)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )
    if staff.branch_id is not None:
        statement = statement.where(Table.branch_id == staff.branch_id)
    if date_from is not None:
        statement = statement.where(Order.created_at >= date_from)
    if date_to is not None:
        statement = statement.where(Order.created_at <= date_to)

    rows = db.execute(statement).all()
    return [{"menu_item_id": r.id, "title": r.title, "total_quantity": r.total_quantity} for r in rows]

@router.delete("/{order_id}", status_code=204)
def void_order(
    order_id: UUID,
    staff: CurrentStaff = Depends(require_permission("void_orders")),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this order")

    order.status = OrderStatus.cancelled
    db.commit()



@router.post("", response_model=OrderOut)
def create_order_for_customer(
    payload: StaffOrderCreate,
    staff: CurrentStaff = Depends(require_permission("place_orders")),
    db: Session = Depends(get_db),
):
    table = db.get(Table, payload.table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")

    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Table not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to order at this table")

    order = Order(
        table_id=table.id,
        seat_number=payload.seat_number,
        special_request=payload.special_request,
        status=OrderStatus.pending,
        total_amount=0,
        placed_by_staff_id=staff.user_id,
    )
    db.add(order)
    db.flush()

    promos = active_promos(db, staff.tenant_id, table.branch_id)
    categories = category_map(db, [i.menu_item_id for i in payload.items])

    total = Decimal("0")
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")

        unit_price, _titles = price_for(menu_item, promos, categories)
        line_total = unit_price * item_in.quantity
        total += line_total

        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                quantity=item_in.quantity,
                unit_price=unit_price,
                total_price=line_total,
            )
        )

    order.total_amount = total
    db.commit()
    db.refresh(order)
    return order

@router.patch("/{order_id}", response_model=OrderOut)
def update_order_items(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    staff: CurrentStaff = Depends(require_permission("edit_orders")),
    db: Session = Depends(get_db),
):
    """Staff editing an order that's still pending. Once a station has picked
    it up, only adding is allowed — see add_items_to_order."""
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this order")

    if order.status != OrderStatus.pending:
        raise HTTPException(
            status_code=400,
            detail="This order has already been started. You can add items, but not change them.",
        )

    if payload.seat_number is not None:
        order.seat_number = payload.seat_number
    if payload.special_request is not None:
        order.special_request = payload.special_request or None

    if payload.items is not None:
        if not payload.items:
            raise HTTPException(
                status_code=400,
                detail="An order needs at least one item. Void it instead if it's not wanted.",
            )

        promos = active_promos(db, staff.tenant_id, table.branch_id)
        categories = category_map(db, [i.menu_item_id for i in payload.items])

        for existing in list(order.order_items):
            db.delete(existing)
        db.flush()

        total = Decimal("0")
        for item_in in payload.items:
            menu_item = db.get(MenuItem, item_in.menu_item_id)
            if menu_item is None or not menu_item.is_available:
                raise HTTPException(
                    status_code=404, detail="Menu item not found or unavailable"
                )

            unit_price, _titles = price_for(menu_item, promos, categories)
            line_total = unit_price * item_in.quantity
            total += line_total

            db.add(
                OrderItem(
                    order_id=order.id,
                    menu_item_id=menu_item.id,
                    quantity=item_in.quantity,
                    unit_price=unit_price,
                    total_price=line_total,
                )
            )

        order.total_amount = total

    db.commit()
    db.refresh(order)
    return order




@router.post("/{order_id}/items", response_model=OrderOut)
def add_items_to_order(
    order_id: uuid.UUID,
    payload: OrderItemsAdd,
    staff: CurrentStaff = Depends(require_permission("place_orders")),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this order")

    if order.status in (OrderStatus.completed, OrderStatus.cancelled):
        raise HTTPException(
            status_code=400, detail="This order is closed and can't be added to."
        )

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to add.")

    promos = active_promos(db, staff.tenant_id, table.branch_id)
    categories = category_map(db, [i.menu_item_id for i in payload.items])

    added = Decimal("0")
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")

        unit_price, _titles = price_for(menu_item, promos, categories)
        line_total = unit_price * item_in.quantity
        added += line_total

        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                quantity=item_in.quantity,
                unit_price=unit_price,
                total_price=line_total,
            )
        )

    order.total_amount = Decimal(order.total_amount) + added
    db.commit()
    db.refresh(order)
    return order