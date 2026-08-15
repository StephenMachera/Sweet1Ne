import uuid
from pydantic import BaseModel ,ConfigDict

class MenuItemIn(BaseModel):
    sub_category_id: uuid.UUID
    title: str
    description: str | None = None
    price: float
    picture: str | None = None
    dietary_tags: list[str] = []
    allergen_tags: list[str] = []


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sub_category_id: uuid.UUID
    title: str
    description: str | None
    price: float
    picture: str | None
    is_available: bool
    dietary_tags: list[str]
    allergen_tags: list[str]

class MenuItemUpdate(BaseModel):
    sub_category_id: uuid.UUID | None = None
    title: str | None = None
    description: str | None = None
    price: float | None = None
    picture: str | None = None
    is_available: bool | None = None
    dietary_tags: list[str] | None = None
    allergen_tags: list[str] | None = None

    