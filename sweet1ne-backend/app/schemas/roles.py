import uuid
from pydantic import BaseModel, ConfigDict

class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    permission_keys: list[str] = []


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    display_name: str
    category: str | None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    is_super_admin: bool
    is_active: bool
    permissions: list[PermissionOut]
    staff_count: int