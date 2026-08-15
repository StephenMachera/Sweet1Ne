import typer

from app.db.session import SessionLocal
from app.models.branch import Branch
from app.models.tenant import Tenant
from app.management.cli import app


@app.command(name="create-branch")
def create_branch(
    tenant_slug: str = typer.Option(..., "--tenant-slug"),
    name: str = typer.Option(...),
    slug: str = typer.Option(...),
    address: str = typer.Option(""),
    phone: str = typer.Option(""),
):
    db = SessionLocal()
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if tenant is None:
        typer.secho(f"No tenant found with slug '{tenant_slug}'.", fg=typer.colors.RED)
        raise typer.Exit(1)

    branch = Branch(tenant_id=tenant.id, name=name, slug=slug, address=address or None, phone=phone or None)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    typer.secho(f"Created branch '{branch.name}' (id={branch.id}) under '{tenant.name}'", fg=typer.colors.GREEN)