"""Deriving an order's status from its items.

The rule that makes split orders work — a kitchen finishing its half
shouldn't mark the whole order ready while the bar is still pouring.
"""

from app.models.orders import OrderStatus
from app.services.order_status import derive_order_status


class TestDeriveOrderStatus:
    def test_all_pending_stays_pending(self):
        result = derive_order_status(
            ["pending", "pending"], OrderStatus.pending
        )

        assert result == OrderStatus.pending

    def test_one_station_starting_does_not_move_the_whole_order(self):
        """The order tracks its least-progressed item, so one station
        starting work doesn't change the order's status on its own."""
        result = derive_order_status(
            ["in_progress", "pending"], OrderStatus.pending
        )

        assert result == OrderStatus.pending
        # The order has started even though not every item has — but it
        # tracks the *least* progressed, so pending wins here.
        assert result == OrderStatus.pending

    def test_all_items_in_progress(self):
        result = derive_order_status(
            ["in_progress", "in_progress"], OrderStatus.pending
        )

        assert result == OrderStatus.in_progress

    def test_kitchen_ready_but_bar_still_pending(self):
        """The split-order case. Food is plated, drinks aren't poured — the
        customer shouldn't be told their order is ready."""
        result = derive_order_status(
            ["ready", "ready", "pending"], OrderStatus.in_progress
        )

        assert result == OrderStatus.pending

    def test_kitchen_ready_and_bar_in_progress(self):
        result = derive_order_status(
            ["ready", "in_progress"], OrderStatus.in_progress
        )

        assert result == OrderStatus.in_progress

    def test_every_item_ready(self):
        result = derive_order_status(
            ["ready", "ready", "ready"], OrderStatus.in_progress
        )

        assert result == OrderStatus.ready

    def test_every_item_served_completes_the_order(self):
        result = derive_order_status(
            ["served", "served"], OrderStatus.ready
        )

        assert result == OrderStatus.completed

    def test_one_item_still_to_collect(self):
        result = derive_order_status(
            ["served", "ready"], OrderStatus.ready
        )

        assert result == OrderStatus.ready

    def test_adding_a_new_item_pulls_a_ready_order_back(self):
        """Someone adds a dessert to an order that was ready — it isn't
        ready any more."""
        result = derive_order_status(
            ["ready", "ready", "pending"], OrderStatus.ready
        )

        assert result == OrderStatus.pending

    def test_cancelled_orders_are_left_alone(self):
        """A cancelled order stays cancelled even if a station advances an
        item — cancelling is deliberate and shouldn't be undone by accident."""
        result = derive_order_status(
            ["served", "served"], OrderStatus.cancelled
        )

        assert result == OrderStatus.cancelled

    def test_an_order_with_no_items_keeps_its_status(self):
        result = derive_order_status([], OrderStatus.pending)

        assert result == OrderStatus.pending

    def test_a_single_item_order(self):
        result = derive_order_status(["ready"], OrderStatus.in_progress)

        assert result == OrderStatus.ready