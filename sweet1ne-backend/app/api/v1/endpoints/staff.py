import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.core.supabase_client import get_supabase_admin
from app.db.session import get_db
from app.models.role import Role
from app.models.staff import Staff
from app.models.branch import Branch
from app.schemas.staff import StaffOut, StaffListOut, StaffDetailOut, StaffUpdate
from app.core.config import settings

router = APIRouter()


class StaffCreate(BaseModel):
    email: str
    full_name: str | None = None
    phone: str | None = None
    role_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    send_invite: bool = True
    password: str | None = None

# HELPER FUNCTIONS

def to_staff_out(
    member: Staff,
    role_name: str,
    branch_slug: str | None,
    is_super_admin: bool,
    include_sensitive: bool,
):
    base = dict(
        id=member.id,
        tenant_id=member.tenant_id,
        branch_id=member.branch_id,
        branch_slug=branch_slug,
        role_id=member.role_id,
        email=member.email,
        full_name=member.full_name,
        phone=member.phone,
        picture_url=member.picture_url,
        employment_type=member.employment_type,
        shift_pattern=member.shift_pattern,
        emergency_contact_name=member.emergency_contact_name,
        emergency_contact_phone=member.emergency_contact_phone,
        hire_date=member.hire_date,
        is_active=member.is_active,
        role_name=role_name,
        is_super_admin=is_super_admin,
    )

    if not include_sensitive:
        return StaffListOut(**base)

    return StaffDetailOut(
        **base,
        date_of_birth=member.date_of_birth,
        address=member.address,
        national_insurance_number=member.national_insurance_number,
        right_to_work_verified=member.right_to_work_verified,
        salary=float(member.salary) if member.salary is not None else None,
        pay_type=member.pay_type,
        notes=member.notes,
    )

def can_view_pay(staff: CurrentStaff) -> bool:
    return staff.is_super_admin or "view_staff_pay" in staff.permissions

def resolve_branch_slug(db: Session, branch_id: uuid.UUID | None) -> str | None:
    if branch_id is None:
        return None
    branch = db.get(Branch, branch_id)
    return branch.slug if branch else None


# API ENDPOINTS

@router.get("", response_model=list[StaffDetailOut | StaffListOut])
def list_staff(
    staff: CurrentStaff = Depends(require_permission("manage_staff")),
    db: Session = Depends(get_db),
):
    include_sensitive = can_view_pay(staff)

    statement = (
        select(Staff, Role.name, Role.is_super_admin, Branch.slug)
        .join(Role, Staff.role_id == Role.id)
        .outerjoin(Branch, Staff.branch_id == Branch.id)
        .where(Staff.tenant_id == staff.tenant_id)
    )
    if staff.branch_id is not None:
        statement = statement.where(Staff.branch_id == staff.branch_id)

    return [
        to_staff_out(member, role_name, branch_slug, role_super, include_sensitive)
        for member, role_name, role_super, branch_slug in db.execute(statement).all()
    ]


@router.post("", response_model=StaffListOut)
def create_staff(
    payload: StaffCreate,
    staff: CurrentStaff = Depends(require_permission("manage_staff")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, payload.role_id)
    if role is None or str(role.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.branch_id is not None:
        branch = db.get(Branch, payload.branch_id)
        if branch is None or str(branch.tenant_id) != staff.tenant_id:
            raise HTTPException(status_code=404, detail="Branch not found")

    admin = get_supabase_admin()

    if payload.send_invite:
        try:
            result = admin.auth.admin.invite_user_by_email(
                payload.email,
                {"redirect_to": f"{settings.FRONTEND_URL}/set-password"},
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Couldn't send the invitation: {e}")
    else:
        if not payload.password or len(payload.password) < 8:
            raise HTTPException(
                status_code=400,
                detail="A password of at least 8 characters is required when not sending an invitation.",
            )
        try:
            result = admin.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,
                }
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Couldn't create the account: {e}")

    user = getattr(result, "user", result)
    user_id = user.id if hasattr(user, "id") else user["id"]
    
    new_staff = Staff(
        id=user_id,
        tenant_id=staff.tenant_id,
        branch_id=payload.branch_id,
        role_id=role.id,
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)

    return to_staff_out(
        new_staff,
        role.name,
        resolve_branch_slug(db, new_staff.branch_id),
        role.is_super_admin,
        can_view_pay(staff),
    )


@router.patch("/{staff_id}/deactivate", response_model=StaffListOut)
def deactivate_staff(
    staff_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_staff")),
    db: Session = Depends(get_db),
):
    target = db.get(Staff, staff_id)
    if target is None or str(target.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    target.is_active = False
    db.commit()
    db.refresh(target)

    role = db.get(Role, target.role_id)
    return to_staff_out(
        target,
        role.name,
        resolve_branch_slug(db, target.branch_id),
        role.is_super_admin,
        can_view_pay(staff),
    )


@router.patch("/{staff_id}/activate", response_model=StaffListOut)
def activate_staff(
    staff_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_staff")),
    db: Session = Depends(get_db),
):
    target = db.get(Staff, staff_id)
    if target is None or str(target.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Staff member not found")

    target.is_active = True
    db.commit()
    db.refresh(target)

    role = db.get(Role, target.role_id)
    return to_staff_out(
        target,
        role.name,
        resolve_branch_slug(db, target.branch_id),
        role.is_super_admin,
        can_view_pay(staff),
    )

@router.patch("/{staff_id}", response_model=StaffDetailOut | StaffListOut)
def update_staff(
    staff_id: uuid.UUID,
    payload: StaffUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_staff")),
    db: Session = Depends(get_db),
):
    target = db.get(Staff, staff_id)
    if target is None or str(target.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if staff.branch_id is not None and str(target.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this staff member")

    can_edit_pay = can_view_pay(staff)
    updates = payload.model_dump(exclude_unset=True)

    if not can_edit_pay:
        for field in (
            "salary", "pay_type", "national_insurance_number",
            "date_of_birth", "address", "notes",
        ):
            updates.pop(field, None)

    if "role_id" in updates and updates["role_id"] is not None:
        new_role = db.get(Role, updates["role_id"])
        if new_role is None or str(new_role.tenant_id) != staff.tenant_id:
            raise HTTPException(status_code=404, detail="Role not found")
        if new_role.is_super_admin:
            raise HTTPException(status_code=403, detail="Super-admin roles can't be assigned here.")

    for field, value in updates.items():
        setattr(target, field, value)

    db.commit()
    db.refresh(target)

    role = db.get(Role, target.role_id)
    return to_staff_out(
        target, role.name, resolve_branch_slug(db, target.branch_id),
        role.is_super_admin, can_edit_pay,
    )