"""add order_mode override to tables

Revision ID: 0ad8fc047ac8
Revises: 53a78bf45b47
Create Date: 2026-09-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0ad8fc047ac8'
down_revision: Union[str, None] = '53a78bf45b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Null means "same as restaurant" — the branch-level default applies.
    op.add_column('tables', sa.Column('order_mode', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('tables', 'order_mode')
