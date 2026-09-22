"""add audience, channels, map_id to campaigns

Revision ID: 53a78bf45b47
Revises: d714dd234d0e
Create Date: 2026-09-24 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '53a78bf45b47'
down_revision: Union[str, None] = 'd714dd234d0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('campaigns', sa.Column('audience', sa.String(), server_default='active', nullable=False))
    op.add_column('campaigns', sa.Column('channels', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False))
    op.add_column('campaigns', sa.Column('map_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('campaigns', 'map_id')
    op.drop_column('campaigns', 'channels')
    op.drop_column('campaigns', 'audience')
