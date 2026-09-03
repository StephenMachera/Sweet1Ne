"""make reservations requested_at nullable for enquiries

Revision ID: e13307507ba1
Revises: e68eb3a9dca9
Create Date: 2026-09-02 15:55:24.189691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e13307507ba1'
down_revision: Union[str, None] = 'e68eb3a9dca9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The model already treats this as nullable (an enquiry has no date),
    # but the original migration never followed — bring the column in line.
    op.alter_column("reservations", "requested_at", nullable=True)


def downgrade() -> None:
    op.alter_column("reservations", "requested_at", nullable=False)
