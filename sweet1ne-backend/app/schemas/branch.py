import uuid

from pydantic import BaseModel, ConfigDict


class BranchIn(BaseModel):
    name: str
    slug: str
    address: str | None = None
    phone: str | None = None
    capacity: int | None = None
    settings: dict = {}
    image_url: str | None = None


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    slug: str
    address: str | None
    phone: str | None
    capacity: int | None
    settings: dict
    image_url: str | None
    is_active: bool