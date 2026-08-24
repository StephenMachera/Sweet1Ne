import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StationItemOut(BaseModel):
    """One line of work for a station."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    order_id: uuid.UUID
    menu_item_id: uuid.UUID
    menu_item_title: str | None
    quantity: int
    status: str
    created_at: datetime


class StationOrderOut(BaseModel):
    """An order as one station sees it — only the items it's responsible for."""
    order_id: uuid.UUID
    table_number: int | None
    region: str | None
    seat_number: int | None
    special_request: str | None
    order_status: str
    placed_by_name: str | None
    created_at: datetime
    items: list[StationItemOut]
    allergen_tags: list[str]


class ItemStatusUpdate(BaseModel):
    status: str  # in_progress | ready | served