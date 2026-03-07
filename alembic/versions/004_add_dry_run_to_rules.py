"""Add is_dry_run column to rules table.

Revision ID: 004_add_dry_run_to_rules
Revises: 003_kick_target_random_timeout
Create Date: 2026-03-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_add_dry_run_to_rules"
down_revision: Union[str, None] = "003_kick_target_random_timeout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rules",
        sa.Column("is_dry_run", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("rules", "is_dry_run")
