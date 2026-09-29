"""add_reservation_is_read

Revision ID: 4594384a4108
Revises: 6cc681b63ea3
Create Date: 2026-09-29 22:48:41.840278

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4594384a4108'
down_revision: Union[str, None] = '6cc681b63ea3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows are treated as already seen (server_default "true" at add
    # time), so nobody wakes up to years of enquiries suddenly marked unread.
    # New rows should start unread, so the default flips right after.
    op.add_column(
        "reservations",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.alter_column("reservations", "is_read", server_default="false")


def downgrade() -> None:
    op.drop_column("reservations", "is_read")
