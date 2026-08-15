import typer

from app.db.session import SessionLocal
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.management.cli import app


@app.command(name="list-branches")
def list_branches(tenant_slug: str = typer.Option(..., "--tenant-slug")):
    db = SessionLocal()
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if tenant is None:
        typer.secho(f"No tenant found with slug '{tenant_slug}'.", fg=typer.colors.RED)
        raise typer.Exit(1)

    branches = db.query(Branch).filter(Branch.tenant_id == tenant.id).all()
    if not branches:
        typer.echo(f"No branches yet under '{tenant_slug}'.")
        return
    for b in branches:
        typer.echo(f"{b.slug:<20} {b.name:<30} ({b.id})")