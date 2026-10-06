"""add_promotion_buttons

Revision ID: dbecf533e68c
Revises: e169c1284ee5
Create Date: 2026-10-07 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'dbecf533e68c'
down_revision: Union[str, None] = 'e169c1284ee5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "promotions",
        sa.Column("buttons", postgresql.JSONB(), nullable=False, server_default="[]"),
    )
    # One-time backfill: each existing promotion's single cta/cta_label
    # becomes a one-button list, so nothing live loses its button.
    op.execute(
        """
        UPDATE promotions
        SET buttons = jsonb_build_array(
            jsonb_build_object(
                'id', 'btn-1',
                'kind', cta,
                'label', cta_label,
                'href', NULL,
                'on', true
            )
        )
        WHERE cta IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("promotions", "buttons")
