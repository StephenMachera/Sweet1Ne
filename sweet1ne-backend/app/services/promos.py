import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.promo import Promo
from app.models.sub_menu_category import SubCategory


def active_promos(
    db: Session, tenant_id: uuid.UUID, branch_id: uuid.UUID | None
) -> list[Promo]:
    """Promos live right now for this branch, plus any tenant-wide ones.
    A NULL start or end means "no bound on that side"."""
    now = datetime.now(timezone.utc)

    statement = select(Promo).where(
        Promo.tenant_id == tenant_id,
        Promo.is_active == True,
        or_(Promo.starts_at.is_(None), Promo.starts_at <= now),
        or_(Promo.ends_at.is_(None), Promo.ends_at >= now),
    )
    if branch_id is not None:
        statement = statement.where(
            or_(Promo.branch_id == branch_id, Promo.branch_id.is_(None))
        )

    return list(db.execute(statement).scalars().all())


def category_map(db: Session, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
    """Which main category each item belongs to — resolved in one query so
    pricing a whole menu doesn't trigger a lookup per item."""
    if not item_ids:
        return {}

    rows = db.execute(
        select(MenuItem.id, MainCategory.id)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(MenuItem.id.in_(item_ids))
    ).all()

    return {item_id: category_id for item_id, category_id in rows}


def promos_for_item(
    promos: list[Promo], menu_item_id: uuid.UUID, main_category_id: uuid.UUID | None
) -> list[Promo]:
    matched = []
    for promo in promos:
        if promo.target_type == "item" and promo.target_menu_item_id == menu_item_id:
            matched.append(promo)
        elif (
            promo.target_type == "category"
            and main_category_id is not None
            and promo.target_main_category_id == main_category_id
        ):
            matched.append(promo)
    return matched


def apply_promos(base_price: Decimal, promos: list[Promo]) -> tuple[Decimal, list[str]]:
    """
    Returns the discounted price and the titles of whatever was applied.

    Percentages compound (two 20%-off promos give 36% off, not 40%), then a
    fixed price overrides — it's an absolute statement about what something
    costs, so it wins over whatever maths preceded it. Floored at zero so
    careless stacking can't produce a negative price.
    """
    price = Decimal(base_price)
    applied: list[str] = []

    for promo in promos:
        if promo.discount_type == "percentage" and promo.discount_percent:
            price = price * (Decimal("1") - Decimal(promo.discount_percent) / Decimal("100"))
            applied.append(promo.title)

    for promo in promos:
        if promo.discount_type == "fixed_price" and promo.fixed_price is not None:
            price = Decimal(promo.fixed_price)
            applied.append(promo.title)

    return max(price.quantize(Decimal("0.01")), Decimal("0")), applied


def price_for(
    menu_item: MenuItem,
    promos: list[Promo],
    categories: dict[uuid.UUID, uuid.UUID],
) -> tuple[Decimal, list[str]]:
    matched = promos_for_item(promos, menu_item.id, categories.get(menu_item.id))
    return apply_promos(Decimal(menu_item.price), matched)


def price_one(
    db: Session, menu_item: MenuItem, promos: list[Promo]
) -> tuple[Decimal, list[str]]:
    """Single-item convenience — resolves the category itself."""
    return price_for(menu_item, promos, category_map(db, [menu_item.id]))