from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.staff import Staff

import jwt
from jwt import PyJWKClient

from app.core.config import settings
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db

_jwks_client = PyJWKClient(
    settings.SUPABASE_JWKS_URL,
    cache_keys=True,
    lifespan=600,   # cache keys for 10 minutes, matching Supabase's own edge cache
    timeout=10,
    )
def decode_supabase_jwt(token: str) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")

        if algorithm == "HS256":
            # Legacy symmetric tokens, still valid during migration
            return jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )

        # New asymmetric tokens — fetch the matching public key by its `kid`
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        print("JWT ERROR:", repr(e))
        raise ValueError("Invalid or expired token")


def get_user_id_from_token(payload: dict)->str:
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Token missing subject claim")
    return user_id



def get_staff_by_id(db: Session, user_id: str) -> Staff | None:
    statement = select(Staff).where(Staff.id == user_id)
    return db.execute(statement).scalar_one_or_none()

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentStaff:
    user_id: str
    tenant_id: str
    branch_id: str | None
    role_name: str
    permissions: set[str]
    is_super_admin: bool

    @property
    def is_director(self) -> bool:
        return self.branch_id is None


def get_current_staff(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentStaff:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    try:
        payload = decode_supabase_jwt(creds.credentials)
        user_id = get_user_id_from_token(payload)
    except ValueError as e:
        print("JWT FAILURE:", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    staff = get_staff_by_id(db, user_id)
    if staff is None or not staff.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active staff account")

    if staff.role is None or not staff.role.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active role assigned")

    return CurrentStaff(
        user_id=str(staff.id),
        tenant_id=str(staff.tenant_id),
        branch_id=str(staff.branch_id) if staff.branch_id else None,
        role_name=staff.role.name,
        permissions={p.key for p in staff.role.permissions},
        is_super_admin=staff.role.is_super_admin,
    )

def require_permission(*keys: str):
    """Passes if the caller has ANY of the given permission keys.

    Multiple keys are for cases where different roles reach the same route
    for different reasons — e.g. a waiter browsing the menu (view_menu) and
    a manager editing it (edit_menu) both need the menu list routes.
    """
    def checker(staff: CurrentStaff = Depends(get_current_staff)) -> CurrentStaff:
        if staff.is_super_admin or any(key in staff.permissions for key in keys):
            return staff
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")

    return checker