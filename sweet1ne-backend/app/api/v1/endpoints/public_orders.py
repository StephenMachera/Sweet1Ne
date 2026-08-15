from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import resolve_branch_from_qr, resolve_customer_order
from app.db.session import get_db
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.table import Table
from app.schemas.orders import OrderCreate, OrderOut, OrderUpdate

router = APIRouter()
@router.post("/orders", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
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
            raise HTTPException(status_code=404, detail=f"Menu item not found or unavailable")

        line_total = menu_item.price * item_in.quantity
        total +=line_total

        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=menu_item.id,
            quantity=item_in.quantity,
            unit_price=menu_item.price,
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


@router.patch("/orders/{order_id}", response_model=OrderOut)
def update_my_order(
    payload: OrderUpdate,
    order  : Order   = Depends(resolve_customer_order),
    db     : Session = Depends(get_db),
):
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
            order.order_items.append(
                OrderItem(
                    menu_item_id=menu_item.id,
                    quantity=item_in.quantity,
                    unit_price=menu_item.price,
                    total_price=line_total,
                )
            )
        order.total_amount = total

    db.commit()
    db.refresh(order)
    return order
