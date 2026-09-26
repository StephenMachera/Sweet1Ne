import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, get_current_staff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.schemas.branch import BranchIn, BranchOrderModeIn, BranchOut, BranchPhoneUrlIn, BranchUpdate

router = APIRouter()


@router.get("", response_model=list[BranchOut])
def list_branches(
    staff: CurrentStaff = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    statement = select(Branch).where(Branch.tenant_id == staff.tenant_id)
    return db.execute(statement).scalars().all()


RESERVED_SLUGS = {"admin", "login", "signup", "api", "auth", "static", "_next"}


@router.post("", response_model=BranchOut)
def create_branch(
    payload: BranchIn,
    staff: CurrentStaff = Depends(require_permission("manage_tenant")),
    db: Session = Depends(get_db),
):
    if payload.slug.lower() in RESERVED_SLUGS:
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.slug}' is reserved and can't be used as a branch URL.",
        )

    branch = Branch(**payload.model_dump(), tenant_id=staff.tenant_id)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.patch("/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: uuid.UUID,
    payload: BranchUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_tenant")),
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, branch_id)
    if branch is None or str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")

    data = payload.model_dump(exclude_unset=True)
    settings_patch = data.pop("settings", None)
    for field, value in data.items():
        setattr(branch, field, value)
    if settings_patch:
        branch.settings = {**branch.settings, **settings_patch}

    db.commit()
    db.refresh(branch)
    return branch


@router.patch("/{branch_id}/order-mode", response_model=BranchOut)
def update_branch_order_mode(
    branch_id: uuid.UUID,
    payload: BranchOrderModeIn,
    staff: CurrentStaff = Depends(require_permission("manage_tables")),
    db: Session = Depends(get_db),
):
    """Narrowly scoped to manage_tables (not manage_tenant, like the general
    branch PATCH above) — this is a floor-operations setting, not company
    configuration, so a floor manager without tenant-wide access can still
    flip it."""
    branch = db.get(Branch, branch_id)
    if branch is None or str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    if payload.order_mode not in ("waiter", "app"):
        raise HTTPException(status_code=400, detail="Order mode must be 'waiter' or 'app'.")

    branch.settings = {**branch.settings, "order_mode": payload.order_mode}
    db.commit()
    db.refresh(branch)
    return branch


@router.patch("/{branch_id}/phone-menu-url", response_model=BranchOut)
def update_branch_phone_menu_url(
    branch_id: uuid.UUID,
    payload: BranchPhoneUrlIn,
    staff: CurrentStaff = Depends(require_permission("manage_tables")),
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, branch_id)
    if branch is None or str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")

    branch.settings = {**branch.settings, "phone_menu_url": payload.phone_menu_url.strip()}
    db.commit()
    db.refresh(branch)
    return branch