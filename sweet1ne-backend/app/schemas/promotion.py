import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class PromotionSurfaces(BaseModel):
    enter: bool = False
    ribbon: bool = False
    phone: bool = False
    mail: bool = False


class PromotionLook(BaseModel):
    still: str = "left"
    tone: str = "glass"
    align: str = "left"


class PromotionIn(BaseModel):
    branch_id: uuid.UUID | None = None
    kind: str = "notice"
    title: str
    kicker: str | None = None
    dek: str | None = None
    cta: str = "book"
    cta_label: str | None = None
    code: str | None = None
    offer: str = "none"
    off: float | None = None
    starts_at: date
    ends_at: date | None = None
    is_on: bool = False
    who: str = "all"
    quiet_days: int = 50
    regular_visits: int = 4
    surfaces: PromotionSurfaces = PromotionSurfaces()
    layout: list[dict[str, Any]] = []
    look: PromotionLook = PromotionLook()
    map_id: str | None = None


class PromotionUpdate(BaseModel):
    branch_id: uuid.UUID | None = None
    kind: str | None = None
    title: str | None = None
    kicker: str | None = None
    dek: str | None = None
    cta: str | None = None
    cta_label: str | None = None
    code: str | None = None
    offer: str | None = None
    off: float | None = None
    starts_at: date | None = None
    ends_at: date | None = None
    is_on: bool | None = None
    who: str | None = None
    quiet_days: int | None = None
    regular_visits: int | None = None
    surfaces: PromotionSurfaces | None = None
    layout: list[dict[str, Any]] | None = None
    look: PromotionLook | None = None
    map_id: str | None = None


class PromotionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    kind: str
    title: str
    kicker: str | None
    dek: str | None
    cta: str
    cta_label: str | None
    code: str | None
    offer: str
    off: float | None
    starts_at: date
    ends_at: date | None
    is_on: bool
    who: str
    quiet_days: int
    regular_visits: int
    surfaces: dict[str, Any]
    layout: list[dict[str, Any]]
    look: dict[str, Any]
    map_id: str | None
    created_at: datetime
    updated_at: datetime


class PublicPromotionOut(BaseModel):
    """What a guest's device is allowed to see — no audience-targeting
    internals, no tenant/branch ids."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    kicker: str | None
    dek: str | None
    cta: str
    cta_label: str | None
    code: str | None
    offer: str
    off: float | None
    layout: list[dict[str, Any]]
    look: dict[str, Any]
    map_id: str | None
