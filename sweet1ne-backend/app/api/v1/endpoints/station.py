import uuid
from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.main_menu_category import MainCategory
from app.models.menu_item import MenuItem
from app.models.orders import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.staff import Staff
from app.models.sub_menu_category import SubCategory
from app.models.table import Table
from app.schemas.station import ItemStatusUpdate, StationItemOut, StationOrderOut
from app.services.order_status import recompute_order_status

router = APIRouter()

ALLOWED_TRANSITIONS = {
    "pending": "in_progress",
    "in_progress": "ready",
    "ready": "served",
}


STATION_PERMISSIONS = {
    "kitchen": "access_kitchen",
    "bar": "access_bar",
}


@router.get("/{station}/orders", response_model=list[StationOrderOut])
def list_station_orders(
    station: str,
    staff: CurrentStaff = Depends(require_permission(*STATION_PERMISSIONS.values())),
    db: Session = Depends(get_db),
):
    """Today's orders for one station, with only that station's items.
    FIFO — oldest first, since that's the order they should be worked."""

    # The dependency above passes with ANY station permission, so check the
    # specific one here — a bartender shouldn't be able to fetch the
    # kitchen's queue by changing the path.
    required = STATION_PERMISSIONS.get(station)
    if required is None:
        raise HTTPException(status_code=404, detail="Unknown station")
    if not (staff.is_super_admin or required in staff.permissions):
        raise HTTPException(status_code=403, detail="Not permitted")

    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)

    statement = (
        select(Order, OrderItem, MenuItem, Table, Staff.full_name)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .join(Table, Order.table_id == Table.id)
        .join(Branch, Table.branch_id == Branch.id)
        .outerjoin(Staff, Order.placed_by_staff_id == Staff.id)
        .where(
            Branch.tenant_id == staff.tenant_id,
            MainCategory.prep_station == station,
            Order.status != OrderStatus.cancelled,
            Order.created_at >= today_start,
        )
        .order_by(Order.created_at.asc(), OrderItem.created_at.asc())
    )
    if staff.branch_id is not None:
        statement = statement.where(Table.branch_id == staff.branch_id)

    grouped: dict[uuid.UUID, StationOrderOut] = {}

    for order, item, menu_item, table, placed_by_name in db.execute(statement).all():
        if order.id not in grouped:
            grouped[order.id] = StationOrderOut(
                order_id=order.id,
                table_number=table.number,
                region=table.region,
                seat_number=order.seat_number,
                special_request=order.special_request,
                order_status=order.status.value,
                placed_by_name=placed_by_name,
                created_at=order.created_at,
                items=[],
                allergen_tags=[],
            )

        entry = grouped[order.id]
        entry.items.append(
            StationItemOut(
                id=item.id,
                order_id=item.order_id,
                menu_item_id=item.menu_item_id,
                menu_item_title=menu_item.title,
                quantity=item.quantity,
                status=item.status,
                created_at=item.created_at,
            )
        )
        # Allergens are lifted to order level — a chef needs "contains nuts"
        # impossible to miss, not buried in one line.
        for tag in menu_item.allergen_tags or []:
            if tag not in entry.allergen_tags:
                entry.allergen_tags.append(tag)

    return list(grouped.values())


@router.patch("/items/{item_id}/status", response_model=StationItemOut)
def update_item_status(
    item_id: uuid.UUID,
    payload: ItemStatusUpdate,
    staff: CurrentStaff = Depends(require_permission("update_order_status")),
    db: Session = Depends(get_db),
):
    """Advance a single item. The station is derived from the item's category
    rather than passed in, so a caller can't claim to work somewhere they don't."""
    item = db.get(OrderItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    order = db.get(Order, item.order_id)
    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Item not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this order")

    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="This order was cancelled.")

    # Work out which station this item belongs to, then check the caller
    # actually works there.
    station = db.execute(
        select(MainCategory.prep_station)
        .join(SubCategory, SubCategory.main_category_id == MainCategory.id)
        .join(MenuItem, MenuItem.sub_category_id == SubCategory.id)
        .where(MenuItem.id == item.menu_item_id)
    ).scalar_one_or_none()

    required = STATION_PERMISSIONS.get(station)
    if required is not None and not (staff.is_super_admin or required in staff.permissions):
        raise HTTPException(status_code=403, detail="Not permitted at this station")

    # One step at a time, forward or back — forward is the normal flow,
    # back covers a mistyped tap without letting anything jump around.
    expected = ALLOWED_TRANSITIONS.get(item.status)
    stepping_back = (
        payload.status in ALLOWED_TRANSITIONS
        and ALLOWED_TRANSITIONS[payload.status] == item.status
    )

    if payload.status != expected and not stepping_back:
        raise HTTPException(
            status_code=400,
            detail=f"Can't move an item from {item.status} to {payload.status}.",
        )

    item.status = payload.status
    db.commit()
    db.refresh(item)

    recompute_order_status(db, order)

    menu_item = db.get(MenuItem, item.menu_item_id)
    return StationItemOut(
        id=item.id,
        order_id=item.order_id,
        menu_item_id=item.menu_item_id,
        menu_item_title=menu_item.title if menu_item else None,
        quantity=item.quantity,
        status=item.status,
        created_at=item.created_at,
    )

@router.patch("/orders/{order_id}/status", response_model=list[StationItemOut])
def advance_whole_order_at_station(
    order_id: uuid.UUID,
    station: str,
    payload: ItemStatusUpdate,
    staff: CurrentStaff = Depends(require_permission("update_order_status")),
    db: Session = Depends(get_db),
):
    """Advance every item at one station in a single tap — what the Accept
    and Ready buttons on a card actually call."""

    # Holding update_order_status isn't enough on its own — the caller must
    # also work at the station they're claiming to advance.
    required = STATION_PERMISSIONS.get(station)
    if required is None:
        raise HTTPException(status_code=404, detail="Unknown station")
    if not (staff.is_super_admin or required in staff.permissions):
        raise HTTPException(status_code=403, detail="Not permitted at this station")

    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    table = db.get(Table, order.table_id)
    branch = db.get(Branch, table.branch_id)
    if str(branch.tenant_id) != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    if staff.branch_id is not None and str(table.branch_id) != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to change this order")
    if order.status == OrderStatus.cancelled:
        raise HTTPException(status_code=400, detail="This order was cancelled.")

    statement = (
        select(OrderItem, MenuItem)
        .join(MenuItem, OrderItem.menu_item_id == MenuItem.id)
        .join(SubCategory, MenuItem.sub_category_id == SubCategory.id)
        .join(MainCategory, SubCategory.main_category_id == MainCategory.id)
        .where(OrderItem.order_id == order.id, MainCategory.prep_station == station)
    )

    updated: list[StationItemOut] = []
    for item, menu_item in db.execute(statement).all():
        # Skip anything already past this step — a card tapped twice, or an
        # item added after the rest were accepted, shouldn't jump backwards.
        if ALLOWED_TRANSITIONS.get(item.status) != payload.status:
            continue

        item.status = payload.status
        updated.append(
            StationItemOut(
                id=item.id,
                order_id=item.order_id,
                menu_item_id=item.menu_item_id,
                menu_item_title=menu_item.title,
                quantity=item.quantity,
                status=item.status,
                created_at=item.created_at,
            )
        )

    db.commit()
    recompute_order_status(db, order)
    return updated