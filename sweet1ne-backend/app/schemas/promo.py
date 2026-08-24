import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PromoIn(BaseModel):
    title: str
    description: str | None = None
    branch_id: uuid.UUID | None = None

    target_type: str = "item"  # item | category
    target_menu_item_id: uuid.UUID | None = None
    target_main_category_id: uuid.UUID | None = None

    discount_type: str = "percentage"  # percentage | fixed_price
    discount_percent: float | None = None
    fixed_price: float | None = None

    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    target_type: str | None = None
    target_menu_item_id: uuid.UUID | None = None
    target_main_category_id: uuid.UUID | None = None
    discount_type: str | None = None
    discount_percent: float | None = None
    fixed_price: float | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool | None = None


class PromoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    title: str
    description: str | None
    target_type: str
    target_menu_item_id: uuid.UUID | None
    target_main_category_id: uuid.UUID | None
    discount_type: str
    discount_percent: float | None
    fixed_price: float | None
    starts_at: datetime | None
    ends_at: datetime | None
    is_active: bool
    # Resolved server-side so the list can show what's targeted without
    # the frontend cross-referencing menu data.
    target_name: str | None = None