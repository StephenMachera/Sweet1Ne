import uuid

from pydantic import BaseModel, ConfigDict


class TableIn(BaseModel):
    # Only meaningful for a director — a manager's own branch always wins,
    # regardless of what's sent here (see the route).
    branch_id: uuid.UUID | None = None
    region: str | None = None
    number: int
    seats: int


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