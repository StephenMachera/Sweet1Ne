import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PromoIn(BaseModel):
    title: str
    description: str | None = None
    discount_percent: float | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class PromoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    title: str
    description: str | None
    discount_percent: float | None
    starts_at: datetime | None
    ends_at: datetime | None
    is_active: bool