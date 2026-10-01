"""add_main_category_picture

Revision ID: 3e0f12aa1a8d
Revises: 4594384a4108
Create Date: 2026-10-01 17:45:19.203266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e0f12aa1a8d'
down_revision: Union[str, None] = '4594384a4108'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("main_categories", sa.Column("picture", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("main_categories", "picture")
