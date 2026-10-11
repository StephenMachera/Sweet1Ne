"""add_promotion_code_rules_and_order_guest_id

Revision ID: 2e17c614b9cb
Revises: dbecf533e68c
Create Date: 2026-10-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e17c614b9cb'
down_revision: Union[str, None] = 'dbecf533e68c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("promotions", sa.Column("min_spend", sa.Numeric(10, 2), nullable=True))
    op.add_column("promotions", sa.Column("max_uses", sa.Integer(), nullable=True))
    op.add_column(
        "promotions",
        sa.Column("once_per_guest", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("orders", sa.Column("guest_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "guest_id")
    op.drop_column("promotions", "once_per_guest")
    op.drop_column("promotions", "max_uses")
    op.drop_column("promotions", "min_spend")
