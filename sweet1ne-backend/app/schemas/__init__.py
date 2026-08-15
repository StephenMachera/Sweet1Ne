import uuid
from pydantic import BaseModel, ConfigDict

class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    role: str
    email: str
    full_name: str | None
    phone: str | None
    is_active: bool