import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class ScanIn(BaseModel):
    email: EmailStr
    # Unticked by default; a scan without the tick never switches consent off.
    newsletter_opt_in: bool = False
    device_id: str = Field(min_length=8, max_length=100)
    # The table's qr_token — the same one the menu endpoints use.
    qr_token: uuid.UUID


class ScanOut(BaseModel):
    session_id: uuid.UUID
    is_returning: bool


class TrackEventIn(BaseModel):
    type: Literal["page_view", "item_view", "add_to_basket", "search", "cta_click"]
    path: str | None = None
    referrer: str | None = None
    menu_item_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    search_text: str | None = None
    results_count: int | None = Field(default=None, ge=0, le=100000)


class TrackIn(BaseModel):
    source: Literal["website", "qr_menu"]
    events: list[TrackEventIn] = Field(min_length=1, max_length=20)
    device_id: str | None = Field(default=None, min_length=8, max_length=100)
    qr_token: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
