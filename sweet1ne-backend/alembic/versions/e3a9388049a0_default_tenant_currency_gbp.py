"""default_tenant_currency_gbp

Revision ID: e3a9388049a0
Revises: 275a4626eae4
Create Date: 2026-09-29 22:15:16.500972

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3a9388049a0'
down_revision: Union[str, None] = '275a4626eae4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only the default for future rows — this app is UK-only in practice,
    # and "USD" was a leftover generic-scaffold value that never matched a
    # real tenant. Existing rows are fixed directly, not by this migration,
    # since a schema migration shouldn't silently overwrite real data.
    op.alter_column("tenants", "currency", server_default="GBP")


def downgrade() -> None:
    op.alter_column("tenants", "currency", server_default="USD")
