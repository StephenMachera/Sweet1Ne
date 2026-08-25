from sqlalchemy.orm import Session

from app.models.orders import Order, OrderStatus

# Item statuses, weakest first. An order sits at the status of its
# least-progressed item, so the kitchen marking its lines ready doesn't
# complete an order whose drinks are still being poured.
ITEM_STATUSES = ["pending", "in_progress", "ready", "served"]

ITEM_TO_ORDER = {
    "pending": OrderStatus.pending,
    "in_progress": OrderStatus.in_progress,
    "ready": OrderStatus.ready,
    "served": OrderStatus.completed,
}


def derive_order_status(
    item_statuses: list[str], current: OrderStatus
) -> OrderStatus:
    """Works out what an order's status should be, given its items.

    Pure — no database, no side effects — so the rule can be tested on its
    own and reasoned about without a session.
    """
    # Cancelling is a deliberate act that item progress shouldn't undo.
    if current == OrderStatus.cancelled:
        return current

    if not item_statuses:
        return current

    weakest = min(item_statuses, key=lambda s: ITEM_STATUSES.index(s))
    return ITEM_TO_ORDER[weakest]


def recompute_order_status(db: Session, order: Order) -> Order:
    """Applies derive_order_status and saves the result."""
    new_status = derive_order_status(
        [item.status for item in order.order_items], order.status
    )

    if new_status != order.status:
        order.status = new_status
        db.commit()
        db.refresh(order)

    return order