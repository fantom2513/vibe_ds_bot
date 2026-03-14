"""Add mute level system tables: mute_xp, mute_levels, mute_sessions.

Revision ID: 005_mute_system
Revises: 004_add_dry_run_to_rules
Create Date: 2026-03-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_mute_system"
down_revision: Union[str, None] = "004_add_dry_run_to_rules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mute_xp",
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("level", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_mute_seconds", sa.BigInteger(), nullable=False, server_default=sa.text("0")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("discord_id"),
    )

    op.create_table(
        "mute_levels",
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("xp_required", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=True),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("level"),
    )

    op.create_table(
        "mute_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("ended_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mute_sessions_discord_id", "mute_sessions", ["discord_id"])
    op.create_index("ix_mute_sessions_started_at", "mute_sessions", ["started_at"])


def downgrade() -> None:
    op.drop_index("ix_mute_sessions_started_at", "mute_sessions")
    op.drop_index("ix_mute_sessions_discord_id", "mute_sessions")
    op.drop_table("mute_sessions")
    op.drop_table("mute_levels")
    op.drop_table("mute_xp")
