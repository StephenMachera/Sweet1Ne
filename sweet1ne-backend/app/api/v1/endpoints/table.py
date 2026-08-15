import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentStaff, require_permission
from app.db.session import get_db
from app.models.branch import Branch
from app.models.table import Table
from app.schemas.table import TableIn, TableOptionOut, TableOut

router = APIRouter()


@router.get("", response_model=list[TableOut | TableOptionOut])
def list_tables(
    branch_id: uuid.UUID | None = None,
    staff: CurrentStaff = Depends(require_permission("manage_tables", "place_orders")),
    db: Session = Depends(get_db),
):
    statement = select(Table).join(Branch, Table.branch_id == Branch.id).where(
        Branch.tenant_id == staff.tenant_id
    )
    if staff.branch_id is not None:
        statement = statement.where(Table.branch_id == staff.branch_id)
    elif branch_id is not None:
        statement = statement.where(Table.branch_id == branch_id)

    tables = db.execute(statement).scalars().all()

    can_manage = staff.is_super_admin or "manage_tables" in staff.permissions
    if can_manage:
        return tables

    return [TableOptionOut.model_validate(t) for t in tables]


@router.post("", response_model=TableOut)
def create_table(
    payload: TableIn,
    staff: CurrentStaff = Depends(require_permission("manage_tables")),
    db: Session = Depends(get_db),
):
    if staff.branch_id is not None:
        branch_id = staff.branch_id
    else:
        if payload.branch_id is None:
            raise HTTPException(status_code=400, detail="branch_id is required for a director")
        branch = db.get(Branch, payload.branch_id)
        if branch is None or branch.tenant_id != staff.tenant_id:
            raise HTTPException(status_code=404, detail="Branch not found")
        branch_id = payload.branch_id

    table = Table(
        branch_id=branch_id,
        region=payload.region,
        number=payload.number,
        seats=payload.seats,
    )
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}", response_model=TableOut)
def update_table(
    table_id: uuid.UUID,
    payload: TableIn,
    staff: CurrentStaff = Depends(require_permission("manage_tables")),
    db: Session = Depends(get_db),
):
    table = db.get(Table, table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    branch = db.get(Branch, table.branch_id)
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Table not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this table")

    updates = payload.model_dump(exclude_unset=True, exclude={"branch_id"})
    for field, value in updates.items():
        setattr(table, field, value)
    db.commit()
    db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=204)
def delete_table(
    table_id: uuid.UUID,
    staff: CurrentStaff = Depends(require_permission("manage_tables")),
    db: Session = Depends(get_db),
):
    table = db.get(Table, table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")
    branch = db.get(Branch, table.branch_id)
    if branch.tenant_id != staff.tenant_id:
        raise HTTPException(status_code=404, detail="Table not found")
    if staff.branch_id is not None and table.branch_id != staff.branch_id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this table")

    table.is_active = False
    db.commit()