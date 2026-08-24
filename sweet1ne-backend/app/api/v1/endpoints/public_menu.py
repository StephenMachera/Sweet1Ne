import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import resolve_branch_from_qr, scope_to_branch
from app.db.session import get_db
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.models.branch import Branch
from app.models.tenant import Tenant


from app.schemas.main_menu_category import MainCategoryOut
from app.schemas.menu_items import MenuItemOut
from app.schemas.sub_menu_category import SubCategoryOut
from app.schemas.table import PublicTableOut

from app.services.promos import active_promos, price_for, category_map

router = APIRouter()


@router.get("/main-categories", response_model=list[MainCategoryOut])
def public_list_main_categories(
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = select(MainCategory)
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)
    categories = db.execute(statement).scalars().all()
    return categories


@router.get("/sub-categories", response_model=list[SubCategoryOut])
def public_list_sub_categories(
    main_category_id: uuid.UUID | None = None,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = (
        select(SubCategory)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(SubCategory.is_active == True, MainCategory.is_active == True)
    )
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)
    if main_category_id is not None:
        statement = statement.where(SubCategory.main_category_id == main_category_id)

    sub_categories = db.execute(statement).scalars().all()
    return sub_categories


@router.get("/menu-items", response_model=list[MenuItemOut])
def public_list_menu_items(
    main_category_id: uuid.UUID | None = None,
    sub_category_id: uuid.UUID | None = None,
    q: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    dietary_tag: str | None = None,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
):
    statement = (
        select(MenuItem)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(
            MenuItem.is_available == True,
            SubCategory.is_active == True,
            MainCategory.is_active == True,
        )
    )
    statement = scope_to_branch(statement, table.branch.tenant_id, table.branch_id)

    if main_category_id is not None:
        statement = statement.where(MainCategory.id == main_category_id)
    if sub_category_id is not None:
        statement = statement.where(MenuItem.sub_category_id == sub_category_id)
    if q is not None:
        search = f"%{q}%"
        statement = statement.where(or_(MenuItem.title.ilike(search), MenuItem.description.ilike(search)))
    if min_price is not None:
        statement = statement.where(MenuItem.price >= min_price)
    if max_price is not None:
        statement = statement.where(MenuItem.price <= max_price)
    if dietary_tag is not None:
        statement = statement.where(MenuItem.dietary_tags.contains([dietary_tag]))

    items = db.execute(statement).scalars().all()

    promos = active_promos(db, table.branch.tenant_id, table.branch_id)
    categories = category_map(db, [i.id for i in items])

    results = []
    for item in items:
        out = MenuItemOut.model_validate(item)
        discounted, titles = price_for(item, promos, categories)
        if titles:
            out.promo_price = float(discounted)
            out.promo_titles = titles
        results.append(out)

    return results

@router.get("/table/{qr_token}", response_model=PublicTableOut)
def get_table_context(
    qr_token: uuid.UUID,
    db: Session = Depends(get_db),
):
    table = resolve_branch_from_qr(str(qr_token), db)
    branch = db.get(Branch, table.branch_id)
    tenant = db.get(Tenant, branch.tenant_id)

    settings_blob = tenant.settings or {}

    return PublicTableOut(
        table_number=table.number,
        region=table.region,
        seats=table.seats,
        branch_name=branch.name,
        branch_slug=branch.slug,
        tenant_name=tenant.name,
        logo_url=tenant.logo_url,
        currency=tenant.currency,
        ask_for_name=bool(settings_blob.get("ask_for_customer_name", False)),
    )