import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


def _looks_like_a_name(name: str) -> bool:
    """Real names have a space (first + last) and are made of letters and
    the odd apostrophe/hyphen — not a single unbroken run of random-cased
    letters, which is what every bot submission so far has looked like."""
    stripped = name.strip()
    if not (2 <= len(stripped) <= 100):
        return False
    if " " not in stripped:
        return False
    return all(c.isalpha() or c in " '-." for c in stripped)


class ReservationIn(BaseModel):
    branch_id: uuid.UUID
    name: str
    email: EmailStr
    phone: str
    reservation_type: str = "table"  # table | private | enquiry
    party_size: int = 1
    requested_at: datetime | None = None
    occasion: str | None = None
    notes: str | None = None
    marketing_consent: bool = False
    # Honeypot — a real visitor never sees or fills this field (hidden by
    # CSS on the real form); a bot filling in every field it finds does.
    # Anything here means silently drop the submission, not save it.
    website: str = ""
    # Cloudflare Turnstile's token — only the Contact form's widget sends
    # one today, so this is only required (checked in the endpoint) when
    # reservation_type == "enquiry".
    turnstile_token: str = ""

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        if not _looks_like_a_name(value):
            raise ValueError("Please enter your full name.")
        return value


class ReservationDecision(BaseModel):
    status: str  # confirmed | declined | cancelled
    staff_message: str | None = None


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    name: str
    email: str
    phone: str
    reservation_type: str
    party_size: int
    requested_at: datetime | None
    occasion: str | None
    notes: str | None
    status: str
    staff_message: str | None
    handled_at: datetime | None
    marketing_consent: bool
    created_at: datetime

    branch_name: str | None = None
    handled_by_name: str | None = None


class ReservationPublicOut(BaseModel):
    """What the customer's browser gets back — deliberately minimal."""
    id: uuid.UUID
    status: str
    branch_name: str
    requested_at: datetime | None