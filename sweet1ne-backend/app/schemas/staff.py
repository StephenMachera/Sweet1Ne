import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class StaffOut(BaseModel):
    """Used by /auth/me — describes the logged-in person, including their own
    permissions."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    branch_slug: str | None
    email: str
    full_name: str | None
    phone: str | None
    is_active: bool
    role_name: str
    permissions: list[str]
    is_super_admin: bool



class StaffListOut(BaseModel):
    """Basic details — anyone with manage_staff sees this."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    branch_slug: str | None
    role_id: uuid.UUID | None
    email: str
    full_name: str | None
    phone: str | None
    picture_url: str | None
    employment_type: str | None
    shift_pattern: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    hire_date: datetime | None
    is_active: bool
    role_name: str
    is_super_admin: bool


class StaffDetailOut(StaffListOut):
    """Adds sensitive fields — only returned to callers with view_staff_pay."""
    date_of_birth: date | None
    address: str | None
    national_insurance_number: str | None
    right_to_work_verified: bool
    salary: float | None
    pay_type: str | None
    notes: str | None


class StaffUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    picture_url: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    employment_type: str | None = None
    national_insurance_number: str | None = None
    right_to_work_verified: bool | None = None
    shift_pattern: str | None = None
    notes: str | None = None
    salary: float | None = None
    pay_type: str | None = None
    hire_date: datetime | None = None
    role_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None