import typer

from app.db.session import SessionLocal
from app.models.permission import Permission
from app.management.cli import app

DEFAULT_PERMISSIONS = [
    ("edit_menu", "Edit Menu", "menu"),
    ("manage_tables", "Manage Tables", "operations"),
    ("manage_staff", "Manage Staff", "administration"),
    ("manage_roles", "Manage Roles", "administration"),
    ("view_orders", "View Orders", "orders"),
    ("place_orders", "Place Orders (on behalf of a customer)", "orders"),
    ("edit_orders", "Edit Order Items", "orders"),
    ("update_order_status", "Update Order Status", "orders"),
    ("void_orders", "Void Orders", "orders"),
    ("access_reports", "Access Reports", "reports"),
    ("manage_store", "Manage Store/Inventory", "operations"),
    ("manage_settings", "Manage Hotel Settings", "administration"),
    ("manage_tenant", "Manage Tenant/Company Settings", "administration"),
    ("manage_promotions", "Manage Promotions", "marketing"),
    ("view_menu", "View Menu", "menu"),
    ("view_staff_pay", "View Staff Pay & Personal Details", "administration"),
]


@app.command(name="seed-permissions")
def seed_permissions():
    """Idempotent: safe to run multiple times, only inserts what's missing."""
    db = SessionLocal()
    existing_keys = {p.key for p in db.query(Permission).all()}

    added = 0
    for key, display_name, category in DEFAULT_PERMISSIONS:
        if key not in existing_keys:
            db.add(Permission(key=key, display_name=display_name, category=category))
            added += 1

    db.commit()
    typer.secho(f"Added {added} new permission(s); {len(existing_keys)} already existed.", fg=typer.colors.GREEN)