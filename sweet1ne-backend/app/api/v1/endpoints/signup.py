from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import Depends

from app.core.supabase_client import get_supabase_admin
from app.db.session import get_db
from app.models.role import Role
from app.models.staff import Staff
from app.models.tenant import Tenant

router = APIRouter()


class SignupRequest(BaseModel):
    tenant_name: str
    tenant_slug: str
    full_name: str
    email: str
    password: str


@router.post("/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing_tenant = db.query(Tenant).filter(Tenant.slug == payload.tenant_slug).first()
    if existing_tenant:
        raise HTTPException(status_code=400, detail="This company is already set up. Contact your administrator.")

    tenant = Tenant(name=payload.tenant_name, slug=payload.tenant_slug)
    db.add(tenant)
    db.flush()

    director_role = Role(
        tenant_id=tenant.id,
        name="Director",
        description="Full access — created automatically at signup",
        is_super_admin=True,
    )
    db.add(director_role)
    db.flush()

    admin = get_supabase_admin()
    auth_result = admin.auth.admin.create_user(
        {"email": payload.email, "password": payload.password, "email_confirm": True}
    )
    user = getattr(auth_result, "user", auth_result)
    user_id = user.id if hasattr(user, "id") else user["id"]

    staff = Staff(
        id=user_id,
        tenant_id=tenant.id,
        branch_id=None,
        role_id=director_role.id,
        email=payload.email,
        full_name=payload.full_name,
    )
    db.add(staff)
    db.commit()

    return {"message": "Account created", "tenant_id": str(tenant.id)}