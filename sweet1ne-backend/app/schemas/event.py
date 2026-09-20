import uuid
from datetime import datetime
from typing import Any

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
    # See Event.layout / Event.ctas for the recognised shapes.
    layout: list[dict[str, Any]] = []
    ctas: list[dict[str, Any]] = []


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
    layout: list[dict[str, Any]] | None = None
    ctas: list[dict[str, Any]] | None = None


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
    layout: list[dict[str, Any]]
    ctas: list[dict[str, Any]]
    branch_name: str | None = None