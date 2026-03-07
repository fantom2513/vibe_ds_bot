"""Add max_timeout_sec to kick_targets for random interval support.

Revision ID: 003_kick_target_random_timeout
Revises: 002_stacking_kick
Create Date: 2026-03-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_kick_target_random_timeout"
down_revision: Union[str, None] = "002_stacking_kick"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "kick_targets",
        sa.Column("max_timeout_sec", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("kick_targets", "max_timeout_sec")
