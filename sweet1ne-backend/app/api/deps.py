import uuid
from fastapi import HTTPException,Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.models.table import Table
from app.models.main_menu_category import MainCategory
from app.models.orders import Order
from app.core.security import CurrentStaff


def resolve_branch_from_qr(qr_token: str, db: Session = Depends(get_db)) -> Table:
    table = (
        db.query(Table)
        .filter(Table.qr_token == qr_token, Table.is_active == True)
        .first()
    )
    if table is None:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    return table

def scope_to_branch(statement, tenant_id: uuid.UUID, branch_id: uuid.UUID | None):
    """
    Assumes MainCategory is already part of the query (either the thing
    being selected directly, or already .join()-ed in for sub-categories/
    menu-items). Filters to one tenant, plus — if the caller is
    branch-scoped — only that branch's data or anything tenant-wide.
    """
    statement = statement.where(MainCategory.tenant_id == tenant_id)
    if branch_id is not None:
        statement = statement.where(
            (MainCategory.branch_id == branch_id) | (MainCategory.branch_id.is_(None))
        )
    return statement

def resolve_customer_order(
    order_id: uuid.UUID,
    table: Table = Depends(resolve_branch_from_qr),
    db: Session = Depends(get_db),
)->Order:
    order = db.get(Order, order_id)
    if order is None or order.table_id != table.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

def resolve_menu_scope(
    staff: CurrentStaff,
    branch_id: uuid.UUID | None,
    shared_only: bool,
):
    """
    Returns a filter condition for MainCategory.branch_id, or None if no
    extra filtering applies.

    Branch-scoped staff never filter further — scope_to_branch has already
    restricted them to their own branch plus shared. Only a director, who
    sees everything by default, needs narrowing.
    """
    if staff.branch_id is not None:
        return None
    if shared_only:
        return MainCategory.branch_id.is_(None)
    if branch_id is not None:
        return or_(MainCategory.branch_id == branch_id, MainCategory.branch_id.is_(None))
    return None