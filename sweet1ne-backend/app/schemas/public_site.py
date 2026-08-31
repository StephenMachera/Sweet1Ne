from pydantic import BaseModel
import uuid
from app.schemas.orders import OrderItemIn


class PublicCategoryOut(BaseModel):
    id: str
    name: str
    # None for a main category; the main category's id for a subcategory.
    parent_id: str | None


class PublicMenuItemOut(BaseModel):
    id: str
    title: str
    description: str | None
    price: float
    promo_price: float | None
    promo_titles: list[str]
    picture: str | None
    dietary_tags: list[str]
    allergen_tags: list[str]
    main_category_id: str
    sub_category_id: str
    # Empty means tenant-wide — available at every branch.
    branch_ids: list[str]


class PublicMenuOut(BaseModel):
    categories: list[PublicCategoryOut]
    items: list[PublicMenuItemOut]

class PublicLocationOut(BaseModel):
    id: str
    slug: str
    name: str
    address: str | None
    phone: str | None
    capacity: int | None
    image_url: str | None
    opening_time: str | None
    closing_time: str | None

class CollectionOrderIn(BaseModel):
    branch_id: uuid.UUID
    customer_name: str
    customer_phone: str
    collection_time: str
    notes: str | None = None
    items: list[OrderItemIn]

class CollectionOrderOut(BaseModel):
    """Deliberately minimal — the customer's browser only needs enough to
    show the confirmation screen."""
    id: uuid.UUID
    total_amount: float