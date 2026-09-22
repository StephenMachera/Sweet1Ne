from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr

class SubscribeIn(BaseModel):
    email: EmailStr
    consented: bool


class SubscriberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    source: str
    is_subscribed: bool
    consented_at: datetime
    unsubscribed_at: datetime | None


class SubscriberStats(BaseModel):
    total: int
    subscribed: int
    unsubscribed: int
    from_website: int
    from_reservations: int


class SubscriberCreateIn(BaseModel):
    email: EmailStr
    source: str = "import"
    consented: bool = False


class SubscriberCreateOut(BaseModel):
    subscriber: SubscriberOut
    # False when an existing row was updated instead of a new one made —
    # lets the caller (manual add or a CSV import loop) tally
    # added/updated/skipped the same way the reference template does.
    created: bool


class SubscriberToggleIn(BaseModel):
    is_subscribed: bool