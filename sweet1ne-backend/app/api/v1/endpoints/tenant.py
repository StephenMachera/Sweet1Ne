from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.tenant import Tenant

router = APIRouter()


class TenantUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    tagline: str | None = None
    settings: dict | None = None


@router.patch("")
def update_tenant(
    payload: TenantUpdate,
    staff: CurrentStaff = Depends(require_permission("manage_tenant")),
    db: Session = Depends(get_db),
):
    tenant = db.get(Tenant, staff.tenant_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return tenant