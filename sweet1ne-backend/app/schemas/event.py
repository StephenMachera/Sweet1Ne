import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventIn(BaseModel):
    title: str
    slug: str
    tagline: str | None = None
    description: str | None = None
    image_url: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    price_note: str | None = None
    branch_id: uuid.UUID | None = None
    is_featured: bool = True
    is_published: bool = True


class EventUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    tagline: str | None = None
    description: str | None = None
    image_url: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    price_note: str | None = None
    is_featured: bool | None = None
    is_published: bool | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    title: str
    slug: str
    tagline: str | None
    description: str | None
    image_url: str | None
    starts_at: datetime
    ends_at: datetime | None
    price_note: str | None
    is_featured: bool
    is_published: bool
    branch_name: str | None = None