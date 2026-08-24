from sqlalchemy.orm import Session

from app.models.orders import Order, OrderStatus

ITEM_STATUSES = ["pending", "in_progress", "ready", "served"]

ITEM_TO_ORDER = {
    "pending": OrderStatus.pending,
    "in_progress": OrderStatus.in_progress,
    "ready": OrderStatus.ready,
    "served": OrderStatus.completed
}

def recompute_order_status(db: Session, order: Order)-> Order:
    """Derives the order's status from its items. Cancelled orders are left
    alone — cancelling is a deliberate act that item progress shouldn't undo."""

    if order.status == OrderStatus.cancelled:
        return order

    items = [i for i in order.order_items]
    if not items:
        return order

    weakest = min(items, key=lambda i, : ITEM_STATUSES.index(i.status))
    order.status = ITEM_TO_ORDER[weakest.status]
    
    db.commit()
    db.refresh(order)
    return order
