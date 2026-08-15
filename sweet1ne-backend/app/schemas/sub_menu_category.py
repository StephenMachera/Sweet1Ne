import uuid
from pydantic import BaseModel, ConfigDict

class SubCategoryIn(BaseModel):
    main_category_id: uuid.UUID
    name: str
    slug: str
    description: str | None = None


class SubCategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    main_category_id: uuid.UUID
    name: str
    slug: str
    description: str | None
    sort_order: int
    is_active: bool


class SubCategoryUpdate(BaseModel):
    main_category_id: uuid.UUID | None = None
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None