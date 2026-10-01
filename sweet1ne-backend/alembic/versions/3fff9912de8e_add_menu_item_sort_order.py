"""add_menu_item_sort_order

Revision ID: 3fff9912de8e
Revises: 3e0f12aa1a8d
Create Date: 2026-10-02 00:47:06.385995

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fff9912de8e'
down_revision: Union[str, None] = '3e0f12aa1a8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "menu_items",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("menu_items", "sort_order")
