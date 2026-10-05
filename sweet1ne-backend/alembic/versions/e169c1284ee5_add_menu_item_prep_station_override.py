"""add_menu_item_prep_station_override

Revision ID: e169c1284ee5
Revises: f71de08a860f
Create Date: 2026-10-05 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e169c1284ee5'
down_revision: Union[str, None] = 'f71de08a860f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "menu_items",
        sa.Column("prep_station_override", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("menu_items", "prep_station_override")
