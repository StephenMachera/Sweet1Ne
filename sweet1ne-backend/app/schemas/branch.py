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


class BranchUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    # Merged into the existing dict, not replaced — settings also holds
    # things this form never touches (QR toggles, tax overrides, etc.).
    settings: dict | None = None


class BranchOrderModeIn(BaseModel):
    order_mode: str  # "waiter" | "app"


class BranchPhoneUrlIn(BaseModel):
    # A general ordering/menu link for this branch — separate from any
    # single table's own QR code, e.g. for a website "Order online" button.
    phone_menu_url: str = ""


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