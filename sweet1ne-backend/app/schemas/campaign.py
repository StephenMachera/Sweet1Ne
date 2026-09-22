import uuid
from typing import Any
from datetime import datetime
from pydantic import  BaseModel, ConfigDict, EmailStr


class CampaignIn(BaseModel):
    name: str
    subject: str
    preheader: str | None = None
    blocks: list[dict[str, Any]] = []
    audience: str = "active"
    channels: dict[str, bool] = {}
    map_id: str | None = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    subject: str
    preheader: str | None
    blocks: list[dict[str, Any]]
    status: str
    audience: str
    channels: dict[str, bool]
    map_id: str | None
    sent_at: datetime | None
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime


class TestSendIn(BaseModel):
    email: EmailStr


class PreviewOut(BaseModel):
    html: str