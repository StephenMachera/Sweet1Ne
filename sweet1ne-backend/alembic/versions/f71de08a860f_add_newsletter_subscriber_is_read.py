"""add_newsletter_subscriber_is_read

Revision ID: f71de08a860f
Revises: 898068d5f9e3
Create Date: 2026-10-05 15:31:29.934116

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f71de08a860f'
down_revision: Union[str, None] = '898068d5f9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "newsletter_subscribers",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("newsletter_subscribers", "is_read")
