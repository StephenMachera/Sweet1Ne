import typer

from app.core.supabase_client import get_supabase_admin
from app.db.session import SessionLocal
from app.models.branch import Branch
from app.models.role import Role
from app.models.staff import Staff
from app.models.tenant import Tenant
from app.management.cli import app


@app.command(name="create-staff")
def create_staff(
    tenant_slug: str = typer.Option(..., "--tenant-slug"),
    email: str = typer.Option(...),
    role_name: str = typer.Option(..., "--role-name", help="Must already exist for this tenant, e.g. 'Director'"),
    full_name: str = typer.Option("", "--full-name"),
    phone: str = typer.Option(""),
    branch_slug: str = typer.Option(None, "--branch-slug", help="Omit for a director (all branches)"),
    password: str = typer.Option(None, help="If omitted, you'll be prompted (input hidden)."),
):
    if not password:
        password = typer.prompt("Password", hide_input=True, confirmation_prompt=True)

    db = SessionLocal()
    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if tenant is None:
        typer.secho(f"No tenant found with slug '{tenant_slug}'.", fg=typer.colors.RED)
        raise typer.Exit(1)

    role = db.query(Role).filter(Role.tenant_id == tenant.id, Role.name == role_name).first()
    if role is None:
        typer.secho(f"No role named '{role_name}' exists for this tenant yet.", fg=typer.colors.RED)
        raise typer.Exit(1)

    branch_id = None
    if branch_slug:
        branch = db.query(Branch).filter(Branch.tenant_id == tenant.id, Branch.slug == branch_slug).first()
        if branch is None:
            typer.secho(f"No branch with slug '{branch_slug}' under this tenant.", fg=typer.colors.RED)
            raise typer.Exit(1)
        branch_id = branch.id

    admin = get_supabase_admin()
    auth_result = admin.auth.admin.create_user({"email": email, "password": password, "email_confirm": True})
    user = getattr(auth_result, "user", auth_result)
    user_id = user.id if hasattr(user, "id") else user["id"]

    staff = Staff(
        id=user_id,
        tenant_id=tenant.id,
        branch_id=branch_id,
        role_id=role.id,
        email=email,
        full_name=full_name or None,
        phone=phone or None,
    )
    db.add(staff)
    db.commit()

    scope = f"branch '{branch_slug}'" if branch_id else "all branches"
    typer.secho(f"Created staff '{email}' — role={role_name}, {scope}", fg=typer.colors.GREEN)