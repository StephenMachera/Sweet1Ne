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
from app.schemas.main_menu_category import MainCategoryOut
from app.schemas.menu_items import MenuItemOut
from app.schemas.sub_menu_category import SubCategoryOut

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
    return items