"""Stacking pairs and kick timeout tables.

Revision ID: 002_stacking_kick
Revises: 001_create
Create Date: 2025-02-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_stacking_kick"
down_revision: Union[str, None] = "001_create"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kick_targets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=True),
        sa.Column("timeout_sec", sa.Integer(), nullable=False, server_default=sa.text("3600")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("discord_id", name="kick_targets_discord_id_key"),
    )

    op.create_table(
        "stacking_pairs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id_1", sa.BigInteger(), nullable=False),
        sa.Column("user_id_2", sa.BigInteger(), nullable=False),
        sa.Column("target_channel_id", sa.BigInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id_1", "user_id_2", name="uq_stacking_pairs_user_ids"),
    )


def downgrade() -> None:
    op.drop_table("stacking_pairs")
    op.drop_table("kick_targets")
