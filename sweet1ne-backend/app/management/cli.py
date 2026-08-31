import typer
import uuid
from app.models.branch import Branch
from app.models.table import Table
from sqlalchemy import select
from app.db.session import SessionLocal

app = typer.Typer(
    help="Sweet1NE management commands — tenant/branch/staff provisioning.",
    add_completion=False,
)

from app.management.commands import (  # noqa: E402, F401
    seed_permissions,
    create_tenant,
    create_branch,
    create_staff,
    list_tenants,
    list_branches,
)

# app/management/cli.py

@app.command()
def create_collection_tables():
    """One table per branch, reserved for collection orders — so takeaway
    flows through the existing kitchen queue without any new plumbing."""
    db = SessionLocal()
    try:
        branches = db.execute(select(Branch)).scalars().all()

        for branch in branches:
            existing = db.execute(
                select(Table).where(
                    Table.branch_id == branch.id, Table.region == "Collection"
                )
            ).scalars().first()

            if existing:
                typer.echo(f"{branch.name}: already has one")
                continue

            # Number 0 keeps it out of the way of real tables.
            table = Table(
                branch_id=branch.id,
                number=0,
                seats=0,
                region="Collection",
                qr_token=uuid.uuid4(),
                is_active=True,
            )
            db.add(table)
            typer.echo(f"{branch.name}: created")

        db.commit()
    finally:
        db.close()