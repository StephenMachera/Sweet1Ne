from pydantic import BaseModel, ConfigDict


class TenantSettingsOut(BaseModel):
    """Company-wide configuration. The columns are real; the rest lives in
    Tenant.settings (JSONB) so new options need no migration."""
    model_config = ConfigDict(from_attributes=True)

    # General
    name: str
    logo_url: str | None
    currency: str
    timezone: str

    # Privacy
    ask_for_customer_name: bool = False
    show_staff_names_to_customers: bool = True
    order_retention_days: int = 365

    # Safety
    allergen_notice: str | None = None
    food_hygiene_rating: int | None = None


class TenantSettingsIn(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    currency: str | None = None
    timezone: str | None = None

    ask_for_customer_name: bool | None = None
    show_staff_names_to_customers: bool | None = None
    order_retention_days: int | None = None

    allergen_notice: str | None = None
    food_hygiene_rating: int | None = None


class BranchSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str

    # General
    address: str | None
    phone: str | None
    capacity: int | None
    opening_time: str | None = None
    closing_time: str | None = None

    # Service — currently hardcoded in the customer tracker and kitchen screen
    prep_minutes_min: int = 15
    prep_minutes_max: int = 25
    overdue_warning_minutes: int = 10
    overdue_alert_minutes: int = 20

    # Safety
    emergency_phone: str | None = None
    fire_assembly_point: str | None = None
    first_aider_name: str | None = None


class BranchSettingsIn(BaseModel):
    address: str | None = None
    phone: str | None = None
    capacity: int | None = None
    opening_time: str | None = None
    closing_time: str | None = None

    prep_minutes_min: int | None = None
    prep_minutes_max: int | None = None
    overdue_warning_minutes: int | None = None
    overdue_alert_minutes: int | None = None

    emergency_phone: str | None = None
    fire_assembly_point: str | None = None
    first_aider_name: str | None = None