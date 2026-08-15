import uuid

from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy  import select, or_

from app.core.security import CurrentStaff, get_current_staff, require_permission
from app.db.session import get_db

# Import the Models
from app.models.main_menu_category import MainCategory
from app.models.sub_menu_category import SubCategory
from app.models.menu_item import MenuItem
from app.models.branch import Branch

# Import the Pydantic Schemas
from app.schemas.main_menu_category import MainCategoryIn, MainCategoryOut, MainCategoryUpdate
from app.schemas.sub_menu_category import SubCategoryIn, SubCategoryOut, SubCategoryUpdate
from app.schemas.menu_items import MenuItemIn, MenuItemOut, MenuItemUpdate

from app.api.deps import scope_to_branch, resolve_menu_scope

router = APIRouter()


# =======================================
#     POST ROUTES FOR MENUMANAGEMENT
# =======================================
@router.post("/main-categories", response_model=MainCategoryOut)
def create_main_category(
    payload: MainCategoryIn,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    if staff.branch_id is not None:
        branch_id = staff.branch_id          # manager: always their own
    else:
        branch_id = payload.branch_id        # director: their choice, None = shared
        if branch_id is not None:
            branch = db.get(Branch, branch_id)
            if branch is None or branch.tenant_id != staff.tenant_id:
                raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.model_dump(exclude={"branch_id"})
    category = MainCategory(**data, tenant_id=staff.tenant_id, branch_id=branch_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

@router.post("/sub-categories",response_model=SubCategoryOut)
def create_sub_category(
    payload : SubCategoryIn,
    staff   :CurrentStaff = Depends(require_permission("edit_menu")),
    db      :Session = Depends(get_db)
):
    main_category = db.get(MainCategory, payload.main_category_id)
    if main_category is None or str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Main category not found")

    sub_category = SubCategory(**payload.model_dump())
    db.add(sub_category)
    db.commit()
    db.refresh(sub_category)
    return sub_category

@router.post("/menu-items", response_model=MenuItemOut)
def create_menu_item(
    payload: MenuItemIn,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    sub_category = db.get(SubCategory, payload.sub_category_id)
    if sub_category is None:
        raise HTTPException(status_code=404, detail="Sub category not found")

    main_category = db.get(MainCategory, sub_category.main_category_id)
    if main_category is None or str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Sub category not found")

    item = MenuItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# =======================================
#     GET ROUTES FOR MENUMANAGEMENT
# =======================================

from app.api.deps import scope_to_branch


@router.get("/main-categories", response_model=list[MainCategoryOut])
def list_main_categories(
    branch_id: uuid.UUID | None = None,
    shared_only: bool = False,
    include_inactive: bool = False,
    staff: CurrentStaff = Depends(require_permission("view_menu")),
    db: Session = Depends(get_db),
):
    statement = select(MainCategory)
    statement = scope_to_branch(statement, staff.tenant_id, staff.branch_id)

    scope = resolve_menu_scope(staff, branch_id, shared_only)
    if scope is not None:
        statement = statement.where(scope)

    if not include_inactive:
        statement = statement.where(MainCategory.is_active == True)

    return db.execute(statement).scalars().all()


@router.get("/sub-categories", response_model=list[SubCategoryOut])
def list_sub_categories(
    main_category_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    shared_only: bool = False,
    include_inactive: bool = False,
    staff: CurrentStaff = Depends(require_permission("view_menu")),
    db: Session = Depends(get_db),
):
    statement = select(SubCategory).join(
        MainCategory, SubCategory.main_category_id == MainCategory.id
    )
    statement = scope_to_branch(statement, staff.tenant_id, staff.branch_id)

    scope = resolve_menu_scope(staff, branch_id, shared_only)
    if scope is not None:
        statement = statement.where(scope)

    if main_category_id is not None:
        statement = statement.where(SubCategory.main_category_id == main_category_id)

    if not include_inactive:
        statement = statement.where(
            SubCategory.is_active == True, MainCategory.is_active == True
        )

    return db.execute(statement).scalars().all()


@router.get("/menu-items", response_model=list[MenuItemOut])
def list_menu_items(
    main_category_id: uuid.UUID | None = None,
    sub_category_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    shared_only: bool = False,
    include_inactive: bool = False,
    q: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    dietary_tag: str | None = None,
    staff: CurrentStaff = Depends(require_permission("view_menu")),
    db: Session = Depends(get_db),
):
    statement = (
        select(MenuItem)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
    )
    statement = scope_to_branch(statement, staff.tenant_id, staff.branch_id)

    scope = resolve_menu_scope(staff, branch_id, shared_only)
    if scope is not None:
        statement = statement.where(scope)

    if not include_inactive:
        statement = statement.where(
            MenuItem.is_available == True,
            SubCategory.is_active == True,
            MainCategory.is_active == True,
        )

    if main_category_id is not None:
        statement = statement.where(MainCategory.id == main_category_id)
    if sub_category_id is not None:
        statement = statement.where(MenuItem.sub_category_id == sub_category_id)
    if q is not None:
        search = f"%{q}%"
        statement = statement.where(
            or_(MenuItem.title.ilike(search), MenuItem.description.ilike(search))
        )
    if min_price is not None:
        statement = statement.where(MenuItem.price >= min_price)
    if max_price is not None:
        statement = statement.where(MenuItem.price <= max_price)
    if dietary_tag is not None:
        statement = statement.where(MenuItem.dietary_tags.contains([dietary_tag]))

    return db.execute(statement).scalars().all()

# =======================================
#     EDIT ROUTES FOR MENUMANAGEMENT
# =======================================
@router.patch("/main-categories/{category_id}", response_model=MainCategoryOut)
def update_main_category(
    category_id: uuid.UUID,
    payload: MainCategoryUpdate,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    category = db.get(MainCategory, category_id)
    if category is None or str(category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Main category not found")
    if staff.branch_id is not None and str(category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this category")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.patch("/sub-categories/{sub_category_id}", response_model=SubCategoryOut)
def update_sub_category(
    sub_category_id: uuid.UUID,
    payload: SubCategoryUpdate,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    sub_category = db.get(SubCategory, sub_category_id)
    if sub_category is None:
        raise HTTPException(status_code=404, detail="Sub category not found")

    main_category = db.get(MainCategory, sub_category.main_category_id)
    if main_category is None or str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Sub category not found")
    if staff.branch_id is not None and str(main_category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this sub category")

    if payload.main_category_id is not None:
        new_parent = db.get(MainCategory, payload.main_category_id)
        if new_parent is None or str(new_parent.tenant_id) != staff.tenant_id:
            raise HTTPException(status_code=404, detail="Target main category not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(sub_category, field, value)

    db.commit()
    db.refresh(sub_category)
    return sub_category


@router.patch("/menu-items/{item_id}", response_model=MenuItemOut)
def update_menu_item(
    item_id: uuid.UUID,
    payload: MenuItemUpdate,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    sub_category = db.get(SubCategory, item.sub_category_id)
    main_category = db.get(MainCategory, sub_category.main_category_id)
    if str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    if staff.branch_id is not None and str(main_category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this item")

    if payload.sub_category_id is not None:
        new_sub = db.get(SubCategory, payload.sub_category_id)
        if new_sub is None:
            raise HTTPException(status_code=404, detail="Target sub category not found")
        new_main = db.get(MainCategory, new_sub.main_category_id)
        if new_main is None or str(new_main.tenant_id) != staff.tenant_id:
            raise HTTPException(status_code=404, detail="Target sub category not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


# =======================================
#     DELETE ROUTES FOR MENUMANAGEMENT
# =======================================

@router.delete("/main-categories/{category_id}", status_code=204)
def delete_main_category(
    category_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    category = db.get(MainCategory, category_id)
    if category is None or str(category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Main category not found")
    if staff.branch_id is not None and str(category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this category")

    category.is_active = False
    db.commit()


@router.delete("/sub-categories/{sub_category_id}", status_code=204)
def delete_sub_category(
    sub_category_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    sub_category = db.get(SubCategory, sub_category_id)
    if sub_category is None:
        raise HTTPException(status_code=404, detail="Sub category not found")

    main_category = db.get(MainCategory, sub_category.main_category_id)
    if main_category is None or str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Sub category not found")
    if staff.branch_id is not None and str(main_category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this sub category")

    sub_category.is_active = False
    db.commit()


@router.delete("/menu-items/{item_id}", status_code=204)
def delete_menu_item(
    item_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("edit_menu")),
    db: Session = Depends(get_db),
):
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Menu item not found")

    sub_category = db.get(SubCategory, item.sub_category_id)
    main_category = db.get(MainCategory, sub_category.main_category_id)
    if str(main_category.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Menu item not found")
    if staff.branch_id is not None and str(main_category.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this item")

    item.is_available = False
    db.commit()