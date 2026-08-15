import typer

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