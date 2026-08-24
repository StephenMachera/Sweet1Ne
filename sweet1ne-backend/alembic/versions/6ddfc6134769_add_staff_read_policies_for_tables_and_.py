"""add staff read policies for tables and branches

Revision ID: 6ddfc6134769
Revises: 6d628a9ff60e
Create Date: 2026-08-18 13:13:12.441387

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ddfc6134769'
down_revision: Union[str, None] = '6d628a9ff60e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # `tables` and `branches` already have RLS enabled (turned on outside of
    # Alembic, with no policy ever attached), which silently hides every row
    # from `authenticated` by default. orders_staff_read/order_items_staff_read
    # join through these two tables directly (not via the SECURITY DEFINER
    # helper functions), so that empty visibility made their subqueries
    # always resolve empty too — Realtime never had anything to deliver.
    op.execute("""
        create policy branches_staff_read on branches
          for select to authenticated
          using (
            tenant_id = auth_staff_tenant_id()
            and (auth_staff_branch_id() is null or id = auth_staff_branch_id())
          );
    """)

    op.execute("""
        create policy tables_staff_read on tables
          for select to authenticated
          using (
            branch_id in (
              select b.id from branches b
              where b.tenant_id = auth_staff_tenant_id()
                and (auth_staff_branch_id() is null or b.id = auth_staff_branch_id())
            )
          );
    """)


def downgrade() -> None:
    op.execute("drop policy if exists tables_staff_read on tables;")
    op.execute("drop policy if exists branches_staff_read on branches;")
