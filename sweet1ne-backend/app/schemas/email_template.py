from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Any
import uuid

class EmailTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str
    subject: str
    preheader: str | None
    blocks: list[dict[str, Any]]
    background: str | None
    background_animated: bool

class EmailTemplateIn(BaseModel):
    name: str
    description: str
    subject: str
    preheader: str | None
    blocks: list[dict[str, Any]]
    background: str | None = None
    background_animated: bool = False


class EmailTemplateTestSendIn(BaseModel):
    """Stateless, like /campaigns/preview — sends whatever's currently in
    the composer, saved or not, rather than requiring the template to be
    saved first."""
    subject: str
    preheader: str | None = None
    blocks: list[dict[str, Any]] = []
    background: str | None = None
    background_animated: bool = False
    email: EmailStr