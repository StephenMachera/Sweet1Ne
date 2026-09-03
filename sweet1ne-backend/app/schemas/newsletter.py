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