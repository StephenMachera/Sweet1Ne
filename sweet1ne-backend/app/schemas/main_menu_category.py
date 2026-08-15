import uuid
from pydantic import BaseModel, ConfigDict

class MainCategoryIn(BaseModel):
    name: str
    slug: str
    description: str | None = None
    branch_id: uuid.UUID | None = None

class MainCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    name: str
    slug: str
    description: str | None
    sort_order: int
    is_active: bool

class MainCategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None