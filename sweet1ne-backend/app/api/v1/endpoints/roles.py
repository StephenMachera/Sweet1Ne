import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.permission import Permission
from app.models.role import Role
from app.models.staff import Staff
from app.schemas.roles import RoleCreate, RoleOut, PermissionOut

router = APIRouter()

@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(staff: CurrentStaff = Depends(require_permission("manage_roles", "manage_staff"))):
    # Global catalog — same for every tenant, no filtering needed
    from app.db.session import SessionLocal
    db = SessionLocal()
    return db.query(Permission).all()


@router.get("", response_model=list[RoleOut])
def list_roles(
    staff: CurrentStaff = Depends(require_permission("manage_roles","manage_staff")),
    db: Session = Depends(get_db),
):
    roles = db.execute(
        select(Role).where(Role.tenant_id == staff.tenant_id)
    ).scalars().all()

    counts = dict(
        db.execute(
            select(Staff.role_id, func.count(Staff.id))
            .where(Staff.tenant_id == staff.tenant_id, Staff.is_active == True)
            .group_by(Staff.role_id)
        ).all()
    )

    return [
        RoleOut(
            id=role.id,
            name=role.name,
            description=role.description,
            is_super_admin=role.is_super_admin,
            is_active=role.is_active,
            permissions=[PermissionOut.model_validate(p) for p in role.permissions],
            staff_count=counts.get(role.id, 0),
        )
        for role in roles
    ]


@router.post("", response_model=RoleOut)
def create_role(
    payload: RoleCreate,
    staff: CurrentStaff = Depends(require_permission("manage_roles")),
    db: Session = Depends(get_db),
):
    permissions = db.query(Permission).filter(Permission.key.in_(payload.permission_keys)).all()

    role = Role(
        tenant_id=staff.tenant_id,
        name=payload.name,
        description=payload.description,
        created_by=staff.user_id,
        permissions=permissions,
    )
    db.add(role)
    db.commit()
    db.refresh(role)

    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        is_super_admin=role.is_super_admin,
        is_active=role.is_active,
        permissions=[PermissionOut.model_validate(p) for p in role.permissions],
        staff_count=0,
    )


@router.patch("/{role_id}/permissions", response_model=RoleOut)
def update_role_permissions(
    role_id: uuid.UUID,
    payload: RoleCreate,
    staff: CurrentStaff = Depends(require_permission("manage_roles")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None or str(role.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Role not found")

    permissions = db.query(Permission).filter(Permission.key.in_(payload.permission_keys)).all()
    role.permissions = permissions  # replaces the whole set, same "resend everything" pattern as order edits
    db.commit()
    db.refresh(role)

    staff_count = db.execute(
        select(func.count(Staff.id)).where(
            Staff.role_id == role.id, Staff.is_active == True
        )
    ).scalar_one()

    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        is_super_admin=role.is_super_admin,
        is_active=role.is_active,
        permissions=[PermissionOut.model_validate(p) for p in role.permissions],
        staff_count=staff_count,
    )

@router.patch("/{role_id}/deactivate", response_model=RoleOut)
def deactivate_role(
    role_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_roles")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None or str(role.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_super_admin:
        raise HTTPException(status_code=400, detail="The Director role can't be deactivated.")

    role.is_active = False
    db.commit()
    db.refresh(role)

    staff_count = db.execute(
        select(func.count(Staff.id)).where(
            Staff.role_id == role.id, Staff.is_active == True
        )
    ).scalar_one()

    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        is_super_admin=role.is_super_admin,
        is_active=role.is_active,
        permissions=[PermissionOut.model_validate(p) for p in role.permissions],
        staff_count=staff_count,
    )

def to_role_out(role: Role, staff_count: int) -> RoleOut:
    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        is_super_admin=role.is_super_admin,
        is_active=role.is_active,
        permissions=[PermissionOut.model_validate(p) for p in role.permissions],
        staff_count=staff_count,
    )

@router.patch("/{role_id}/activate", response_model=RoleOut)
def activate_role(
    role_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_roles")),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None or str(role.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Role not found")

    role.is_active = True
    db.commit()
    db.refresh(role)

    staff_count = db.execute(
        select(func.count(Staff.id)).where(
            Staff.role_id == role.id, Staff.is_active == True
        )
    ).scalar_one()

    return to_role_out(role, staff_count)