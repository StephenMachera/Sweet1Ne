import typer

from app.db.session import SessionLocal
from app.models.tenant import Tenant
from app.management.cli import app


@app.command(name="list-tenants")
def list_tenants():
    db = SessionLocal()
    tenants = db.query(Tenant).all()
    if not tenants:
        typer.echo("No tenants yet.")
        return
    for t in tenants:
        typer.echo(f"{t.slug:<20} {t.name:<30} ({t.id})")