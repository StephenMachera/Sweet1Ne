from pydantic import BaseModel

class BranchStats(BaseModel):
    branch_id: str
    branch_name: str
    orders_today: int
    revenue_today: float
    live_orders: int
    average_order_value: float


class TopItem(BaseModel):
    menu_item_id: str
    title: str
    total_quantity: int


class OverviewOut(BaseModel):
    orders_today: int
    revenue_today: float
    live_orders: int
    average_order_value: float
    by_branch: list[BranchStats]
    top_items: list[TopItem]

class TrendPoint(BaseModel):
    """One bucket on the trend chart — an hour, a day, or a month depending
    on the period requested."""
    label: str
    revenue: float
    orders: int


class BranchBreakdown(BaseModel):
    branch_id: str
    branch_name: str
    revenue: float
    orders: int
    average_order_value: float


class NamedTotal(BaseModel):
    """Used for both category performance and item rankings."""
    id: str
    name: str
    revenue: float
    quantity: int


class StaffActivity(BaseModel):
    staff_id: str | None
    name: str
    orders: int
    revenue: float


class ReportOut(BaseModel):
    period: str
    range_label: str

    revenue: float
    orders: int
    average_order_value: float

    # Same figures for the previous comparable period, so the UI can show
    # direction rather than a bare number.
    previous_revenue: float
    previous_orders: int

    trend: list[TrendPoint]
    by_branch: list[BranchBreakdown]
    by_category: list[NamedTotal]
    top_items: list[NamedTotal]
    bottom_items: list[NamedTotal]
    by_hour: list[TrendPoint]
    by_staff: list[StaffActivity]