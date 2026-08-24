"""enable rls and realtime for station screens

Revision ID: 6d628a9ff60e
Revises: 7c28a99a986c
Create Date: 2026-08-17 16:49:44.459399

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d628a9ff60e'
down_revision: Union[str, None] = '7c28a99a986c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Helper functions -------------------------------------------------
    # SECURITY DEFINER so they can read `staff` even though RLS is on it.
    # STABLE so Postgres doesn't re-run them per row.
    op.execute("""
        create or replace function auth_staff_tenant_id()
        returns uuid language sql security definer stable as $$
          select tenant_id from staff where id = auth.uid() and is_active
        $$;
    """)

    op.execute("""
        create or replace function auth_staff_branch_id()
        returns uuid language sql security definer stable as $$
          select branch_id from staff where id = auth.uid() and is_active
        $$;
    """)

    # --- Grants -----------------------------------------------------------
    # Tables created by Alembic (as postgres) don't get the privileges
    # Supabase's own tooling applies, so `authenticated` can't see them at
    # all until we say so. RLS then narrows what those grants expose.
    op.execute("grant select on orders to authenticated;")
    op.execute("grant select on order_items to authenticated;")
    op.execute("grant select on staff to authenticated;")

    # --- RLS --------------------------------------------------------------
    for table in ("orders", "order_items", "staff"):
        op.execute(f"alter table {table} enable row level security;")

    # A staff member may read their own row — that's what the helper
    # functions resolve against.
    op.execute("""
        create policy staff_read_self on staff
          for select to authenticated
          using (id = auth.uid());
    """)

    # Orders: reachable only through a table in the caller's tenant, and
    # narrowed to their own branch unless they're a director (null branch).
    op.execute("""
        create policy orders_staff_read on orders
          for select to authenticated
          using (
            table_id in (
              select t.id
              from tables t
              join branches b on b.id = t.branch_id
              where b.tenant_id = auth_staff_tenant_id()
                and (auth_staff_branch_id() is null
                     or t.branch_id = auth_staff_branch_id())
            )
          );
    """)

    # order_items has no branch of its own — the same join, one level down.
    # RLS on `orders` does NOT cascade into this subquery, so it's repeated.
    op.execute("""
        create policy order_items_staff_read on order_items
          for select to authenticated
          using (
            order_id in (
              select o.id
              from orders o
              join tables t on t.id = o.table_id
              join branches b on b.id = t.branch_id
              where b.tenant_id = auth_staff_tenant_id()
                and (auth_staff_branch_id() is null
                     or t.branch_id = auth_staff_branch_id())
            )
          );
    """)

    # --- Realtime ---------------------------------------------------------
    op.execute("alter publication supabase_realtime add table orders;")
    op.execute("alter publication supabase_realtime add table order_items;")

    # Realtime needs the full old row on updates/deletes to evaluate RLS
    # against what changed, not just the primary key.
    op.execute("alter table orders replica identity full;")
    op.execute("alter table order_items replica identity full;")


def downgrade() -> None:
    op.execute("alter publication supabase_realtime drop table order_items;")
    op.execute("alter publication supabase_realtime drop table orders;")

    op.execute("drop policy if exists order_items_staff_read on order_items;")
    op.execute("drop policy if exists orders_staff_read on orders;")
    op.execute("drop policy if exists staff_read_self on staff;")

    for table in ("order_items", "orders", "staff"):
        op.execute(f"alter table {table} disable row level security;")

    op.execute("drop function if exists auth_staff_branch_id();")
    op.execute("drop function if exists auth_staff_tenant_id();")