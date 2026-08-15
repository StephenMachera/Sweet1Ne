import typer

from app.db.session import SessionLocal
from app.models.tenant import Tenant
from app.management.cli import app


@app.command(name="create-tenant")
def create_tenant(
    name: str = typer.Option(...),
    slug: str = typer.Option(...),
    phone: str = typer.Option(""),
    address: str = typer.Option(""),
):
    db = SessionLocal()
    if db.query(Tenant).filter(Tenant.slug == slug).first():
        typer.secho(f"A tenant with slug '{slug}' already exists.", fg=typer.colors.RED)
        raise typer.Exit(1)

    tenant = Tenant(name=name, slug=slug, phone=phone or None, address=address or None)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    typer.secho(f"Created tenant '{tenant.name}' (id={tenant.id})", fg=typer.colors.GREEN)