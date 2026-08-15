from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, get_current_staff
from app.db.session import get_db
from app.models.staff import Staff
from app.schemas.staff import StaffOut
from app.models.branch import Branch

router = APIRouter()

@router.get("/me", response_model=StaffOut)
def get_me(
    current: CurrentStaff = Depends(get_current_staff),
    db: Session = Depends(get_db),
):
    staff = db.get(Staff, current.user_id)

    branch_slug = None
    if staff.branch_id is not None:
        branch = db.get(Branch, staff.branch_id)
        branch_slug = branch.slug if branch else None

    return StaffOut(
        id=staff.id,
        tenant_id=staff.tenant_id,
        branch_id=staff.branch_id,
        branch_slug=branch_slug,
        email=staff.email,
        full_name=staff.full_name,
        phone=staff.phone,
        is_active=staff.is_active,
        role_name=current.role_name,
        permissions=list(current.permissions),
        is_super_admin=current.is_super_admin,
    )