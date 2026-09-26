import uuid
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class OrderItemIn(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = 1

class OrderCreate(BaseModel):
    qr_token: str
    seat_number: int | None = None
    special_request: str | None = None
    items: list[OrderItemIn]
    # A live code-kind promotion's code, as already shown to this guest on
    # the table phone (see PublicTableOut.promotion) — re-validated here
    # before it's allowed to reduce what they're actually charged.
    promo_code: str | None = None


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    menu_item_id: uuid.UUID
    quantity: int
    unit_price: float
    total_price: float
    created_at: datetime
    menu_item_title: str | None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    table_id: uuid.UUID
    seat_number: int | None
    status: str
    special_request: str | None
    total_amount: float
    promo_code: str | None = None
    order_items: list[OrderItemOut]
    created_at: datetime
    placed_by_staff_id: uuid.UUID | None
    placed_by_name: str | None = None
    branch_id: uuid.UUID | None = None
    branch_name: str | None = None
    table_number: int | None = None

class OrderUpdate(BaseModel):
    seat_number: int | None = None
    special_request: str | None = None
    items: list[OrderItemIn] | None = None  # if provided, replaces the entire item list
    cancel: bool = False

class StaffOrderCreate(BaseModel):
    table_id: uuid.UUID
    seat_number: int | None = None
    special_request: str | None = None
    items: list[OrderItemIn]

class OrderItemsAdd(BaseModel):
    items: list[OrderItemIn]