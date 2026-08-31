import uuid
from decimal import Decimal
from collections import OrderedDict

from fastapi import APIRouter, Depends,HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.main_menu_category import MainCategory
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.menu_item import MenuItem
from app.models.sub_menu_category import SubCategory
from app.models.tenant import Tenant
from app.models.branch import Branch
from app.models.table import Table
from app.schemas.public_site import PublicMenuOut, PublicMenuItemOut, PublicCategoryOut, PublicLocationOut, CollectionOrderIn,CollectionOrderOut
from app.services.promos import active_promos, category_map, price_for

router = APIRouter()


@router.get("/menu", response_model=PublicMenuOut)
def public_menu(db: Session = Depends(get_db)):
    """
    The whole menu for the marketing site — every branch, no qr_token.

    Items shared across branches appear once: the same dish duplicated per
    branch would make the menu read as repetitive, so they're merged by
    title and the branches they belong to are listed on the item instead.
    """
    tenant = db.execute(select(Tenant)).scalars().first()
    if tenant is None:
        return PublicMenuOut(categories=[], items=[])

    rows = db.execute(
        select(MenuItem, SubCategory, MainCategory)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(
            MainCategory.tenant_id == tenant.id,
            MenuItem.is_available == True,
            SubCategory.is_active == True,
            MainCategory.is_active == True,
        )
        .order_by(MainCategory.sort_order, SubCategory.sort_order, MenuItem.title)
    ).all()

    # Tenant-wide promos only — a branch-specific discount can't be honoured
    # on a page that isn't branch-scoped.
    promos = [p for p in active_promos(db, tenant.id, None) if p.branch_id is None]
    categories_by_item = category_map(db, [item.id for item, _, _ in rows])

    merged: OrderedDict[str, PublicMenuItemOut] = OrderedDict()
    main_categories: OrderedDict[uuid.UUID, PublicCategoryOut] = OrderedDict()
    sub_categories: dict[uuid.UUID, PublicCategoryOut] = {}

    for item, sub, main in rows:
        if main.id not in main_categories:
            main_categories[main.id] = PublicCategoryOut(
                id=str(main.id), name=main.name, parent_id=None 
            )

        if sub.id not in sub_categories:
            sub_categories[sub.id] = PublicCategoryOut(
                id=str(sub.id), name=sub.name, parent_id=str(main.id)
            )

        # Merge on title within the same subcategory — the same dish at two
        # branches is one entry on the public menu.
        key = f"{sub.name}::{item.title}".lower()

        if key in merged:
            existing = merged[key]
            if main.branch_id and str(main.branch_id) not in existing.branch_ids:
                existing.branch_ids.append(str(main.branch_id))
            continue

        discounted, promo_titles = price_for(item, promos, categories_by_item)

        merged[key] = PublicMenuItemOut(
            id=str(item.id),
            title=item.title,
            description=item.description,
            price=float(item.price),
            promo_price=float(discounted) if promo_titles else None,
            promo_titles=promo_titles,
            picture=item.picture,
            dietary_tags=item.dietary_tags or [],
            allergen_tags=item.allergen_tags or [],
            main_category_id=str(main.id),
            sub_category_id=str(sub.id),
            branch_ids=[str(main.branch_id)] if main.branch_id else [],
        )

    return PublicMenuOut(
        categories=list(main_categories.values()) + list(sub_categories.values()),
        items=list(merged.values()),
    )

@router.get("/locations", response_model=list[PublicLocationOut])
def public_locations(db: Session = Depends(get_db)):
    """
    Branch details for the marketing site.

    Hours, address and phone come from branch settings, so a manager
    updating them in the dashboard updates the website too.
    """
    tenant = db.execute(select(Tenant)).scalars().first()
    if tenant is None:
        return []

    branches = db.execute(
        select(Branch).where(Branch.tenant_id == tenant.id, Branch.is_active == True)
    ).scalars().all()

    results = []
    for branch in branches:
        blob = branch.settings or {}

        results.append(
            PublicLocationOut(
                id=str(branch.id),
                slug=branch.slug,
                name=branch.name,
                address=branch.address,
                phone=branch.phone,
                capacity=branch.capacity,
                image_url=branch.image_url,
                opening_time=blob.get("opening_time"),
                closing_time=blob.get("closing_time"),
            )
        )

    return results


@router.post("/collection-orders", response_model=CollectionOrderOut)
def create_collection_order(payload: CollectionOrderIn, db: Session = Depends(get_db)):
    """
    A takeaway order.

    Placed against the branch's collection table, so it flows through the
    kitchen queue, statuses and reports exactly like a dine-in order — the
    only difference is where it's collected from.
    """
    branch = db.get(Branch, payload.branch_id)
    if branch is None or not branch.is_active:
        raise HTTPException(status_code=404, detail="Branch not found")

    table = db.execute(
        select(Table).where(
            Table.branch_id == branch.id,
            Table.region == "Collection",
            Table.is_active == True,
        )
    ).scalars().first()

    if table is None:
        raise HTTPException(
            status_code=503,
            detail="Collection orders aren't set up at this branch yet.",
        )

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items in the order.")

    # The customer's name, phone and pickup time go in the special request —
    # it's what the kitchen and whoever hands it over actually need to see.
    request_line = (
        f"COLLECTION {payload.collection_time} · {payload.customer_name} · "
        f"{payload.customer_phone}"
    )
    if payload.notes:
        request_line += f" · {payload.notes}"

    order = Order(
        table_id=table.id,
        seat_number=None,
        special_request=request_line,
        status=OrderStatus.pending,
        total_amount=0,
    )
    db.add(order)
    db.flush()

    promos = active_promos(db, branch.tenant_id, branch.id)
    categories = category_map(db, [i.menu_item_id for i in payload.items])

    total = Decimal("0")
    for item_in in payload.items:
        menu_item = db.get(MenuItem, item_in.menu_item_id)
        if menu_item is None or not menu_item.is_available:
            raise HTTPException(status_code=404, detail="Menu item not found or unavailable")

        unit_price, _ = price_for(menu_item, promos, categories)
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

    return CollectionOrderOut(id=order.id, total_amount=float(order.total_amount))