import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, get_current_staff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.schemas.branch import BranchIn, BranchOut

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