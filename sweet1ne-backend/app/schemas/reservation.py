import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class ReservationIn(BaseModel):
    branch_id: uuid.UUID
    name: str
    email: EmailStr
    phone: str
    reservation_type: str = "table"  # table | private
    party_size: int
    requested_at: datetime
    occasion: str | None = None
    notes: str | None = None
    # Separate from the booking itself — see the route.
    marketing_consent: bool = False


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
    requested_at: datetime
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
    requested_at: datetime