import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.promotion import PublicPromotionOut


class TableIn(BaseModel):
    branch_id: uuid.UUID | None = None
    region: str | None = None
    number: int
    seats: int
    is_active: bool | None = None
    order_mode: str | None = None

class TableUpdate(BaseModel):
    region: str | None = None
    number: int | None = None
    seats: int | None = None
    is_active: bool | None = None
    order_mode: str | None = None

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
    order_mode: str | None

class TableOptionOut(BaseModel):
    """Slim shape for staff picking a table when placing an order."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    region: str | None
    number: int
    seats: int

class PublicTableOut(BaseModel):
    """What a customer's device needs after scanning — enough to confirm
    they're in the right place, plus branding."""
    table_number: int
    region: str | None
    seats: int
    branch_name: str
    branch_slug: str
    tenant_name: str
    logo_url: str | None
    currency: str
    ask_for_name: bool
    allergen_notice: str | None = None
    food_hygiene_rating: int | None = None
    prep_minutes_min: int = 15
    prep_minutes_max: int = 25
    # Resolved: this table's own override if set, else the branch default.
    # "waiter" means guests browse the menu but don't get an order button.
    order_mode: str = "waiter"
    # The live promotion (if any) targeting the table phone right now —
    # resolved server-side from real, scheduled, switched-on promotions.
    promotion: PublicPromotionOut | None = None