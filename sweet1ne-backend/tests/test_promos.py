"""Promotional pricing.

The most important logic in the codebase to get right — it decides what
customers are actually charged.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models.promo import Promo
from app.services.promos import apply_promos, promos_for_item


def make_promo(
    *,
    title="Test promo",
    discount_type="percentage",
    discount_percent=None,
    fixed_price=None,
    target_type="item",
    target_menu_item_id=None,
    target_main_category_id=None,
):
    """A Promo built in memory — never touches the database, since
    apply_promos only reads attributes."""
    return Promo(
        title=title,
        discount_type=discount_type,
        discount_percent=discount_percent,
        fixed_price=fixed_price,
        target_type=target_type,
        target_menu_item_id=target_menu_item_id,
        target_main_category_id=target_main_category_id,
    )


class TestApplyPromos:
    def test_no_promos_leaves_price_unchanged(self):
        price, applied = apply_promos(Decimal("12.50"), [])

        assert price == Decimal("12.50")
        assert applied == []

    def test_single_percentage(self):
        promo = make_promo(discount_percent=20, title="Happy hour")

        price, applied = apply_promos(Decimal("10.00"), [promo])

        assert price == Decimal("8.00")
        assert applied == ["Happy hour"]

    def test_percentages_compound_rather_than_add(self):
        """Two 20% promos give 36% off, not 40% — each applies to what's
        left after the previous one."""
        promos = [
            make_promo(discount_percent=20, title="First"),
            make_promo(discount_percent=20, title="Second"),
        ]

        price, applied = apply_promos(Decimal("10.00"), promos)

        assert price == Decimal("6.40")
        assert applied == ["First", "Second"]

    def test_fixed_price_replaces_the_price(self):
        promo = make_promo(
            discount_type="fixed_price", fixed_price=Decimal("5.00"), title="Clearance"
        )

        price, applied = apply_promos(Decimal("14.00"), [promo])

        assert price == Decimal("5.00")
        assert applied == ["Clearance"]

    def test_fixed_price_wins_over_percentages(self):
        """A fixed price is an absolute statement about what something costs,
        so it should override whatever maths preceded it."""
        promos = [
            make_promo(discount_percent=50, title="Half price"),
            make_promo(
                discount_type="fixed_price", fixed_price=Decimal("7.00"), title="Set price"
            ),
        ]

        price, _ = apply_promos(Decimal("20.00"), promos)

        assert price == Decimal("7.00")

    def test_fixed_price_wins_regardless_of_order(self):
        promos = [
            make_promo(
                discount_type="fixed_price", fixed_price=Decimal("7.00"), title="Set price"
            ),
            make_promo(discount_percent=50, title="Half price"),
        ]

        price, _ = apply_promos(Decimal("20.00"), promos)

        assert price == Decimal("7.00")

    def test_never_goes_below_zero(self):
        """Careless stacking shouldn't mean paying customers to eat."""
        promos = [
            make_promo(
                discount_type="fixed_price", fixed_price=Decimal("-5.00"), title="Mistake"
            ),
        ]

        price, _ = apply_promos(Decimal("10.00"), promos)

        assert price == Decimal("0")

    def test_hundred_percent_is_free_not_negative(self):
        promo = make_promo(discount_percent=100, title="On the house")

        price, _ = apply_promos(Decimal("9.99"), [promo])

        assert price == Decimal("0.00")

    def test_rounds_to_pennies(self):
        """33% off £10 is £6.70, not £6.7000000000000002."""
        promo = make_promo(discount_percent=33, title="Odd discount")

        price, _ = apply_promos(Decimal("10.00"), [promo])

        assert price == Decimal("6.70")
        assert price.as_tuple().exponent == -2

    def test_zero_percent_is_ignored(self):
        """A promo set to 0% shouldn't claim to have applied."""
        promo = make_promo(discount_percent=0, title="Nothing off")

        price, applied = apply_promos(Decimal("10.00"), [promo])

        assert price == Decimal("10.00")
        assert applied == []


class TestPromosForItem:
    def test_matches_a_promo_targeting_that_item(self):
        import uuid

        item_id = uuid.uuid4()
        promo = make_promo(target_type="item", target_menu_item_id=item_id)

        matched = promos_for_item([promo], item_id, None)

        assert matched == [promo]

    def test_ignores_a_promo_targeting_a_different_item(self):
        import uuid

        promo = make_promo(target_type="item", target_menu_item_id=uuid.uuid4())

        matched = promos_for_item([promo], uuid.uuid4(), None)

        assert matched == []

    def test_matches_a_promo_targeting_the_items_category(self):
        import uuid

        category_id = uuid.uuid4()
        promo = make_promo(target_type="category", target_main_category_id=category_id)

        matched = promos_for_item([promo], uuid.uuid4(), category_id)

        assert matched == [promo]

    def test_ignores_a_category_promo_when_the_item_has_no_category(self):
        import uuid

        promo = make_promo(target_type="category", target_main_category_id=uuid.uuid4())

        matched = promos_for_item([promo], uuid.uuid4(), None)

        assert matched == []

    def test_item_and_category_promos_both_apply(self):
        """This is what stacking means in practice — an item-level promo and
        a category-wide one on the same dish."""
        import uuid

        item_id = uuid.uuid4()
        category_id = uuid.uuid4()

        item_promo = make_promo(
            target_type="item", target_menu_item_id=item_id, title="Item"
        )
        category_promo = make_promo(
            target_type="category", target_main_category_id=category_id, title="Category"
        )

        matched = promos_for_item([item_promo, category_promo], item_id, category_id)

        assert len(matched) == 2