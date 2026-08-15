from datetime import date, datetime, timezone, time
from uuid import UUID
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.security import CurrentStaff, get_current_staff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table import Table
from app.models.staff import Staff
from app.schemas.orders import OrderItemIn, OrderOut, StaffOrderCreate, OrderUpdate

router = APIRouter()

@router.get("", response_model=list[OrderOut])
def list_orders(
    status: OrderStatus | None = None,
    branch_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    order_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("view_orders")),
    db: Session = Depends(get_db),
):
    statement = (
        select(Order)
        .join(Table, Order.table_id == Table.id)
        .join(Branch, Table.branch_id == Branch.id)
        .where(Branch.tenant_id == staff.tenant_id)
    )
    # Branch scope
    if staff.branch_id is not None:
        statement = statement.where(Table.branch_id == staff.branch_id)

    # Tenant scope
    if staff.branch_id is None and branch_id is not None:
        statement = statement.where(Table.branch_id == branch_id)
        
    if order_id is not None:
        statement = statement.where(Order.id == order_id)
        return db.execute(statement).scalars().all()

    sees_everything = staff.is_super_admin or "view_all_orders" in staff.permissions
    if not sees_everything:
        statement = statement.where(
            or_(
                Order.placed_by_staff_id == staff.user_id,
                Order.placed_by_staff_id.is_(None),
            )
        )

    if date_from is None and date_to is None:
        today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
        statement = statement.where(Order.created_at >= today_start)
    else:
        if date_from is not None:
            statement = statement.where(Order.created_at >= date_from)
        if date_to is not None:
            statement = statement.where(Order.created_at <= date_to)

    if status is not None:
        statement = statement.where(Order.status == status)

    if q is not None:
        statement = statement.where(Order.special_request.ilike(f"%{q}%"))

    statement = statement.order_by(Order.created_at.desc())
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
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
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
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Table not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to place orders for this table")

    order = Order(
        table_id=table.id,
        seat_number=payload.seat_number,
        special_request=payload.special_request,
        status=OrderStatus.pending,
        total_amount=0,
    )
    db.add(order)
    db.flush()

    total = 0
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")
        line_total = menu_item.price * item_in.quantity
        total += line_total
        db.add(OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            quantity=item_in.quantity,
            unit_price=menu_item.price,
            total_price=line_total,
            placed_by_staff_id=staff.id
        ))

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
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to modify this order")

    if order.status != OrderStatus.pending:
        raise HTTPException(status_code=403, detail="This order can no longer be changed")

    if payload.cancel:
        order.status = OrderStatus.cancelled
        db.commit()
        db.refresh(order)
        return order

    updates = payload.model_dump(exclude_unset=True, exclude={"items", "cancel"})
    for field, value in updates.items():
        setattr(order, field, value)

    if payload.items is not None:
        order.order_items.clear()
        total = 0
        for item_in in payload.items:
            menu_item = db.get(MenuItem, item_in.menu_item_id)
            if menu_item is None or not menu_item.is_available:
                raise HTTPException(status_code=404, detail="Menu item not found or unavailable")
            line_total = menu_item.price * item_in.quantity
            total += line_total
            order.order_items.append(OrderItem(
                menu_item_id=menu_item.id,
                quantity=item_in.quantity,
                unit_price=menu_item.price,
                total_price=line_total,
            ))
        order.total_amount = total

    db.commit()
    db.refresh(order)
    return order

class OrderItemsAdd(BaseModel):
    items: list[OrderItemIn]


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
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this order")

    # Adding is allowed while the order is still open — unlike editing,
    # which closes as soon as the kitchen picks it up.
    if order.status in (OrderStatus.completed, OrderStatus.cancelled):
        raise HTTPException(
            status_code=400, detail="This order is closed and can't be added to."
        )

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to add.")

    added = Decimal("0")
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")

        line_total = menu_item.price * item_in.quantity
        added += line_total
        db.add(
            OrderItem(
                order_id=order.id,
                menu_item_id=menu_item.id,
                quantity=item_in.quantity,
                unit_price=menu_item.price,
                total_price=line_total,
            )
        )

    order.total_amount = order.total_amount + added
    db.commit()
    db.refresh(order)
    return build_order_out(db, order)