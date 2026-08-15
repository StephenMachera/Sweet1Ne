import uuid

from pydantic import BaseModel, ConfigDict


class TableIn(BaseModel):
    branch_id: uuid.UUID | None = None
    region: str | None = None
    number: int
    seats: int
    is_active: bool | None = None

class TableUpdate(BaseModel):
    region: str | None = None
    number: int | None = None
    seats: int | None = None
    is_active: bool | None = None

class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    region: str | None
    number: int
    seats: int
    qr_token: uuid.UUID
    qr_code_url: str | None
    is_active: bool

class TableOptionOut(BaseModel):
    """Slim shape for staff picking a table when placing an order."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    region: str | None
    number: int
    seats: int