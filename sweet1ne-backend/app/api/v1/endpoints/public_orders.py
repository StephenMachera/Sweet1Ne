import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import resolve_branch_from_qr, resolve_customer_order
from app.db.session import get_db
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table import Table
from app.models.branch import Branch
from app.schemas.orders import OrderCreate, OrderOut, OrderUpdate, OrderItemsAdd

from app.services.promos import category_map, price_for, active_promos

router = APIRouter()
@router.post("/orders", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, table.branch_id)

    order = Order(
        table_id=table.id,
        seat_number=payload.seat_number,
        special_request=payload.special_request,
        status=OrderStatus.pending,
        total_amount=0,
    )

    db.add(order)
    db.flush()

    promos = active_promos(db, branch.tenant_id, table.branch_id)
    categories = category_map(db, [i.menu_item_id for i in payload.items])

    total = Decimal("0")
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")

        # What the customer is actually charged — the same figure the menu
        # advertised, since both go through price_for.
        unit_price, _titles = price_for(menu_item, promos, categories)
        line_total = unit_price * item_in.quantity
        total += line_total

        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            quantity=item_in.quantity,
            unit_price=unit_price,
            total_price=line_total,
        )

        db.add(order_item)

    order.total_amount = total
    db.commit()
    db.refresh(order)
    return order

@router.get("/orders/{order_id}", response_model=OrderOut)
def get_my_order(
    order: Order = Depends(resolve_customer_order),
):
    return order

@router.post("/orders/{order_id}/items", response_model=OrderOut)
def add_items_to_my_order(
    order_id: uuid.UUID,
    payload: OrderItemsAdd,
    order: Order = Depends(resolve_customer_order),
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    if order.status in (OrderStatus.completed, OrderStatus.cancelled):
        raise HTTPException(
            status_code=400, detail="This order is closed and can't be added to."
        )

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items to add.")

    branch = db.get(Branch, table.branch_id)
    promos = active_promos(db, branch.tenant_id, table.branch_id)
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




    
@router.patch("/orders/{order_id}", response_model=OrderOut)
def update_my_order(
    order_id: uuid.UUID,
    payload: OrderUpdate,
    order: Order = Depends(resolve_customer_order),
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    """The mercy window — a customer can change or cancel their own order
    while the kitchen hasn't picked it up yet."""
    if order.status != OrderStatus.pending:
        raise HTTPException(
            status_code=400,
            detail="The kitchen has already started this order, so it can't be changed.",
        )

    # Cancelling is a separate intent — nothing else on the payload matters.
    if payload.cancel:
        order.status = OrderStatus.cancelled
        db.commit()
        db.refresh(order)
        return order

    if payload.seat_number is not None:
        order.seat_number = payload.seat_number
    if payload.special_request is not None:
        order.special_request = payload.special_request or None

    if payload.items is not None:
        if not payload.items:
            raise HTTPException(
                status_code=400,
                detail="An order needs at least one item. Cancel it instead if it's not wanted.",
            )

        branch = db.get(Branch, table.branch_id)
        promos = active_promos(db, branch.tenant_id, table.branch_id)
        categories = category_map(db, [i.menu_item_id for i in payload.items])

        # The lines are replaced wholesale rather than diffed — simpler, and
        # the customer is sending the full intended contents either way.
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