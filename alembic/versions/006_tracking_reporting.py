"""Add tracked members and report-channel configuration.

Revision ID: 006_tracking_reporting
Revises: 005_mute_system
Create Date: 2026-08-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_tracking_reporting"
down_revision: Union[str, None] = "005_mute_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tracked_members",
        sa.Column("discord_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("work_days", postgresql.ARRAY(sa.Integer()), nullable=False, server_default=sa.text("'{0,1,2,3,4}'")),
        sa.Column("work_start", sa.Time(), nullable=False, server_default=sa.text("'09:00:00'")),
        sa.Column("work_end", sa.Time(), nullable=False, server_default=sa.text("'18:00:00'")),
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default=sa.text("'Europe/Moscow'")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("discord_id"),
    )
    op.create_table(
        "tracking_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("report_channel_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("tracking_settings")
    op.drop_table("tracked_members")
