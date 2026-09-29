"""default_tenant_timezone_london

Revision ID: 6cc681b63ea3
Revises: e3a9388049a0
Create Date: 2026-09-29 22:18:47.517639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6cc681b63ea3'
down_revision: Union[str, None] = 'e3a9388049a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Same fix as the currency default (e3a9388049a0) and the same reasoning
    # — this app is UK-only in practice, "America/New_York" was a leftover
    # generic-scaffold value. Only the default for future rows; the real
    # tenant's existing value is fixed directly, not by this migration.
    op.alter_column("tenants", "timezone", server_default="Europe/London")


def downgrade() -> None:
    op.alter_column("tenants", "timezone", server_default="America/New_York")
