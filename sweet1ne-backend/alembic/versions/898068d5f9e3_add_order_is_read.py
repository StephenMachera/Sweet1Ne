"""add_order_is_read

Revision ID: 898068d5f9e3
Revises: 3fff9912de8e
Create Date: 2026-10-05 14:03:52.832761

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '898068d5f9e3'
down_revision: Union[str, None] = '3fff9912de8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("orders", "is_read")
