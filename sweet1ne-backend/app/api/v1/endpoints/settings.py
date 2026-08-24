import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.schemas.settings import (
    BranchSettingsIn,
    BranchSettingsOut,
    TenantSettingsIn,
    TenantSettingsOut,
)

router = APIRouter()

# Which fields are real columns rather than JSONB keys.
TENANT_COLUMNS = {"name", "logo_url", "currency", "timezone"}
BRANCH_COLUMNS = {"address", "phone", "capacity"}


def _tenant_out(tenant: Tenant) -> TenantSettingsOut:
    blob = tenant.settings or {}
    return TenantSettingsOut(
        name=tenant.name,
        logo_url=tenant.logo_url,
        currency=tenant.currency,
        timezone=tenant.timezone,
        **{k: v for k, v in blob.items() if k in TenantSettingsOut.model_fields},
    )


def _branch_out(branch: Branch) -> BranchSettingsOut:
    blob = branch.settings or {}
    return BranchSettingsOut(
        id=str(branch.id),
        name=branch.name,
        slug=branch.slug,
        address=branch.address,
        phone=branch.phone,
        capacity=branch.capacity,
        **{k: v for k, v in blob.items() if k in BranchSettingsOut.model_fields},
    )


@router.get("/tenant", response_model=TenantSettingsOut)
def get_tenant_settings(
    staff: CurrentStaff = Depends(require_permission("manage_settings", "manage_tenant")),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, staff.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_out(tenant)


@router.patch("/tenant", response_model=TenantSettingsOut)
def update_tenant_settings(
    payload: TenantSettingsIn,
    staff: CurrentStaff = Depends(require_permission("manage_tenant")),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, staff.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    updates = payload.model_dump(exclude_unset=True)

    # Real columns are set directly; everything else merges into the JSONB
    # blob, which is why a new setting never needs a migration.
    blob = dict(tenant.settings or {})
    for field, value in updates.items():
        if field in TENANT_COLUMNS:
            setattr(tenant, field, value)
        else:
            blob[field] = value

    # Reassigning rather than mutating — SQLAlchemy won't notice an in-place
    # change to a JSONB dict.
    tenant.settings = blob

    db.commit()
    db.refresh(tenant)
    return _tenant_out(tenant)


@router.get("/branches", response_model=list[BranchSettingsOut])
def list_branch_settings(
    staff: CurrentStaff = Depends(require_permission("manage_settings", "manage_tenant")),
    db: Session = Depends(get_db),
):
    statement = select(Branch).where(Branch.tenant_id == staff.tenant_id)
    if staff.branch_id is not None:
        statement = statement.where(Branch.id == staff.branch_id)

    return [_branch_out(b) for b in db.execute(statement).scalars().all()]


@router.patch("/branches/{branch_id}", response_model=BranchSettingsOut)
def update_branch_settings(
    branch_id: uuid.UUID,
    payload: BranchSettingsIn,
    staff: CurrentStaff = Depends(require_permission("manage_settings", "manage_tenant")),
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, branch_id)
    if branch is None or branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Branch not found")
    if staff.branch_id is not None and branch.id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this branch")

    updates = payload.model_dump(exclude_unset=True)

    blob = dict(branch.settings or {})
    for field, value in updates.items():
        if field in BRANCH_COLUMNS:
            setattr(branch, field, value)
        else:
            blob[field] = value

    branch.settings = blob

    db.commit()
    db.refresh(branch)
    return _branch_out(branch)