"""The order lifecycle — where money and state change together.

These are the paths a bug would actually cost something: a customer charged
the wrong price, or an order edited after the kitchen started cooking it.
"""

import uuid
from decimal import Decimal

import pytest

from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.promo import Promo


@pytest.fixture
def steak_promo(db, tenant, branches, menu) -> Promo:
    """25% off the steak, live now — no start or end date means no bound."""
    downtown, _ = branches

    promo = Promo(
        tenant_id=tenant.id,
        branch_id=downtown.id,
        title="Steak night",
        target_type="item",
        target_menu_item_id=menu["steak"].id,
        discount_type="percentage",
        discount_percent=25,
        is_active=True,
    )
    db.add(promo)
    db.flush()
    return promo


def place_order(client, table, items):
    """Helper — the customer path, since it needs no auth."""
    return client.post(
        "/api/v1/public/orders",
        params={"qr_token": str(table.qr_token)},
        json={
            "qr_token": str(table.qr_token),
            "seat_number": None,
            "special_request": None,
            "items": items,
        },
    )


class TestPromoPricing:
    def test_an_order_without_promos_charges_the_list_price(
        self, client, tables, menu
    ):
        downtown_table, _ = tables

        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        assert response.status_code == 200
        assert Decimal(str(response.json()["total_amount"])) == Decimal("20.00")

    def test_an_active_promo_is_actually_charged(
        self, client, tables, menu, steak_promo
    ):
        """The point of the whole promo system — the menu advertises a lower
        price, and this proves the customer is charged it."""
        downtown_table, _ = tables

        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        assert response.status_code == 200
        assert Decimal(str(response.json()["total_amount"])) == Decimal("15.00")

    def test_the_discount_applies_per_unit(self, client, tables, menu, steak_promo):
        downtown_table, _ = tables

        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 3}],
        )

        assert Decimal(str(response.json()["total_amount"])) == Decimal("45.00")

    def test_a_promo_only_affects_the_item_it_targets(
        self, client, tables, menu, steak_promo
    ):
        """Steak is discounted, the pint isn't — £15 plus £5."""
        downtown_table, _ = tables

        response = place_order(
            client,
            downtown_table,
            [
                {"menu_item_id": str(menu["steak"].id), "quantity": 1},
                {"menu_item_id": str(menu["pint"].id), "quantity": 1},
            ],
        )

        assert Decimal(str(response.json()["total_amount"])) == Decimal("20.00")

    def test_the_charged_price_is_recorded_on_the_line(
        self, client, tables, menu, steak_promo, db
    ):
        """unit_price snapshots what was actually paid, so history stays
        accurate after the promo ends."""
        downtown_table, _ = tables

        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        order_id = response.json()["id"]
        line = db.query(OrderItem).filter(OrderItem.order_id == order_id).one()

        assert Decimal(str(line.unit_price)) == Decimal("15.00")

    def test_an_inactive_promo_is_ignored(
        self, client, tables, menu, steak_promo, db
    ):
        steak_promo.is_active = False
        db.flush()

        downtown_table, _ = tables
        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        assert Decimal(str(response.json()["total_amount"])) == Decimal("20.00")

    def test_a_promo_at_another_branch_does_not_apply(
        self, client, tables, menu, steak_promo, branches, db
    ):
        """Moving the promo to Westlands shouldn't discount a Downtown
        order."""
        _, westlands = branches
        steak_promo.branch_id = westlands.id
        db.flush()

        downtown_table, _ = tables
        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        assert Decimal(str(response.json()["total_amount"])) == Decimal("20.00")

    def test_a_tenant_wide_promo_applies_everywhere(
        self, client, tables, menu, steak_promo, db
    ):
        steak_promo.branch_id = None
        db.flush()

        downtown_table, _ = tables
        response = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        )

        assert Decimal(str(response.json()["total_amount"])) == Decimal("15.00")


class TestMercyWindow:
    def test_a_customer_can_edit_a_pending_order(self, client, tables, menu):
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.patch(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(downtown_table.qr_token)},
            json={
                "items": [{"menu_item_id": str(menu["steak"].id), "quantity": 2}]
            },
        )

        assert response.status_code == 200
        assert Decimal(str(response.json()["total_amount"])) == Decimal("40.00")

    def test_a_customer_cannot_edit_an_order_the_kitchen_has_started(
        self, client, tables, menu, db
    ):
        """The mercy window closes the moment a station picks the order up."""
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        order = db.get(Order, uuid.UUID(placed["id"]))
        order.status = OrderStatus.in_progress
        db.flush()

        response = client.patch(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(downtown_table.qr_token)},
            json={
                "items": [{"menu_item_id": str(menu["steak"].id), "quantity": 5}]
            },
        )

        assert response.status_code == 400

    def test_a_customer_can_cancel_a_pending_order(self, client, tables, menu, db):
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.patch(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(downtown_table.qr_token)},
            json={"cancel": True},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"

    def test_an_order_cannot_be_emptied(self, client, tables, menu):
        """Removing every item should be a cancellation, not a £0 order."""
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.patch(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(downtown_table.qr_token)},
            json={"items": []},
        )

        assert response.status_code == 400


class TestAddingItems:
    def test_items_can_be_added_to_an_order_in_progress(
        self, client, tables, menu, db
    ):
        """Editing closes when the kitchen starts, but adding stays open —
        that's the whole point of the distinction."""
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        order = db.get(Order, uuid.UUID(placed["id"]))
        order.status = OrderStatus.in_progress
        db.flush()

        response = client.post(
            f"/api/v1/public/orders/{placed['id']}/items",
            params={"qr_token": str(downtown_table.qr_token)},
            json={"items": [{"menu_item_id": str(menu["pint"].id), "quantity": 1}]},
        )

        assert response.status_code == 200
        assert Decimal(str(response.json()["total_amount"])) == Decimal("25.00")

    def test_items_cannot_be_added_to_a_cancelled_order(
        self, client, tables, menu, db
    ):
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        order = db.get(Order, uuid.UUID(placed["id"]))
        order.status = OrderStatus.cancelled
        db.flush()

        response = client.post(
            f"/api/v1/public/orders/{placed['id']}/items",
            params={"qr_token": str(downtown_table.qr_token)},
            json={"items": [{"menu_item_id": str(menu["pint"].id), "quantity": 1}]},
        )

        assert response.status_code == 400

    def test_adding_nothing_is_rejected(self, client, tables, menu):
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.post(
            f"/api/v1/public/orders/{placed['id']}/items",
            params={"qr_token": str(downtown_table.qr_token)},
            json={"items": []},
        )

        assert response.status_code == 400


class TestCustomerOrderAccess:
    def test_a_customer_needs_the_right_table_token(
        self, client, tables, menu
    ):
        """The two-piece proof — an order id alone is useless without a
        qr_token that resolves to the table it was placed at."""
        downtown_table, westlands_table = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.get(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(westlands_table.qr_token)},
        )

        assert response.status_code == 404

    def test_a_guessed_order_id_finds_nothing(self, client, tables):
        downtown_table, _ = tables

        response = client.get(
            f"/api/v1/public/orders/{uuid.uuid4()}",
            params={"qr_token": str(downtown_table.qr_token)},
        )

        assert response.status_code == 404

    def test_a_customer_can_read_their_own_order(self, client, tables, menu):
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [{"menu_item_id": str(menu["steak"].id), "quantity": 1}],
        ).json()

        response = client.get(
            f"/api/v1/public/orders/{placed['id']}",
            params={"qr_token": str(downtown_table.qr_token)},
        )

        assert response.status_code == 200
        assert response.json()["id"] == placed["id"]


class TestStationSplit:
    def test_each_station_sees_only_its_own_items(
        self, as_staff, chef, bartender, client, tables, menu
    ):
        """A steak and a pint on one order — the kitchen sees the steak, the
        bar sees the pint, neither sees both."""
        downtown_table, _ = tables

        place_order(
            client,
            downtown_table,
            [
                {"menu_item_id": str(menu["steak"].id), "quantity": 1},
                {"menu_item_id": str(menu["pint"].id), "quantity": 1},
            ],
        )

        kitchen = as_staff(chef).get("/api/v1/station/kitchen/orders").json()
        assert len(kitchen) == 1
        kitchen_titles = {i["menu_item_title"] for i in kitchen[0]["items"]}
        assert kitchen_titles == {"Steak"}

        bar = as_staff(bartender).get("/api/v1/station/bar/orders").json()
        assert len(bar) == 1
        bar_titles = {i["menu_item_title"] for i in bar[0]["items"]}
        assert bar_titles == {"Pint"}

    def test_one_station_finishing_does_not_complete_the_order(
        self, as_staff, chef, client, tables, menu, db
    ):
        """The kitchen marking its half ready shouldn't tell the customer
        their drinks are on the way."""
        downtown_table, _ = tables

        placed = place_order(
            client,
            downtown_table,
            [
                {"menu_item_id": str(menu["steak"].id), "quantity": 1},
                {"menu_item_id": str(menu["pint"].id), "quantity": 1},
            ],
        ).json()

        chef_client = as_staff(chef)
        chef_client.patch(
            f"/api/v1/station/orders/{placed['id']}/status",
            params={"station": "kitchen"},
            json={"status": "in_progress"},
        )
        chef_client.patch(
            f"/api/v1/station/orders/{placed['id']}/status",
            params={"station": "kitchen"},
            json={"status": "ready"},
        )

        db.expire_all()
        order = db.get(Order, uuid.UUID(placed["id"]))

        # The pint is untouched, so the order is still at its weakest item.
        assert order.status == OrderStatus.pending