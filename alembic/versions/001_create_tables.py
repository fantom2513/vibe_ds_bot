"""Create all tables: user_lists, rules, action_logs, voice_sessions, schedules.

Revision ID: 001_create
Revises:
Create Date: 2025-02-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_create"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_lists
    op.create_table(
        "user_lists",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=True),
        sa.Column("list_type", sa.String(length=10), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_user_lists_discord_id_list_type",
        "user_lists",
        ["discord_id", "list_type"],
        unique=True,
    )

    # rules
    op.create_table(
        "rules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("target_list", sa.String(length=10), nullable=True),
        sa.Column("channel_ids", postgresql.ARRAY(sa.BigInteger()), nullable=True),
        sa.Column("max_time_sec", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(length=20), nullable=False),
        sa.Column("action_params", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("schedule_cron", sa.String(length=100), nullable=True),
        sa.Column("schedule_tz", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # action_logs (FK -> rules)
    op.create_table(
        "action_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=True),
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("action_type", sa.String(length=20), nullable=True),
        sa.Column("channel_id", sa.BigInteger(), nullable=True),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_action_logs_discord_id", "action_logs", ["discord_id"], unique=False)
    op.create_index("ix_action_logs_executed_at", "action_logs", ["executed_at"], unique=False)

    # voice_sessions
    op.create_table(
        "voice_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_voice_sessions_discord_id_active",
        "voice_sessions",
        ["discord_id"],
        unique=False,
        postgresql_where=sa.text("left_at IS NULL"),
    )

    # schedules (FK -> rules ON DELETE CASCADE)
    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("rule_id", sa.Integer(), nullable=False),
        sa.Column("cron_expr", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=10), nullable=False),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("schedules")
    op.drop_index("ix_voice_sessions_discord_id_active", table_name="voice_sessions")
    op.drop_table("voice_sessions")
    op.drop_index("ix_action_logs_executed_at", table_name="action_logs")
    op.drop_index("ix_action_logs_discord_id", table_name="action_logs")
    op.drop_table("action_logs")
    op.drop_table("rules")
    op.drop_index("uq_user_lists_discord_id_list_type", table_name="user_lists")
    op.drop_table("user_lists")
