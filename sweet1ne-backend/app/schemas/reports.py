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