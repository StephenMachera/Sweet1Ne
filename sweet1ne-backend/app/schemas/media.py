import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MediaIn(BaseModel):
    label: str
    kind: str = "still"
    src: str
    poster: str | None = None
    alt: str | None = None


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    kind: str
    src: str
    poster: str | None
    alt: str | None
    locked: bool
    created_at: datetime
