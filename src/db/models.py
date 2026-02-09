"""
SQLAlchemy 2.0 declarative models for Discord Voice Bot.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base for all models."""

    pass


class UserList(Base):
    """Список пользователей: whitelist или blacklist."""

    __tablename__ = "user_lists"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    discord_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    list_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'whitelist' | 'blacklist'
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        # UNIQUE(discord_id, list_type)
        Index("uq_user_lists_discord_id_list_type", "discord_id", "list_type", unique=True),
    )


class Rule(Base):
    """Правило для голосовых каналов."""

    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    target_list: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # 'whitelist' | 'blacklist'
    channel_ids: Mapped[Optional[list]] = mapped_column(ARRAY(BigInteger), nullable=True)
    max_time_sec: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    action_type: Mapped[str] = mapped_column(String(20), nullable=False)
    action_params: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    schedule_cron: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    schedule_tz: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    action_logs = relationship("ActionLog", back_populates="rule")
    schedules = relationship("Schedule", back_populates="rule", cascade="all, delete-orphan")


class ActionLog(Base):
    """Лог выполненных действий по правилам."""

    __tablename__ = "action_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rule_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    discord_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    action_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    channel_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    rule = relationship("Rule", back_populates="action_logs")

    __table_args__ = (
        Index("ix_action_logs_discord_id", "discord_id"),
        Index("ix_action_logs_executed_at", "executed_at"),
    )


class VoiceSession(Base):
    """Сессия пользователя в голосовом канале."""

    __tablename__ = "voice_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    discord_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    channel_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        # Partial index: (discord_id) WHERE left_at IS NULL
        Index(
            "ix_voice_sessions_discord_id_active",
            "discord_id",
            postgresql_where=text("left_at IS NULL"),
        ),
    )


class Schedule(Base):
    """Расписание включения/выключения правил по cron."""

    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rule_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("rules.id", ondelete="CASCADE"),
        nullable=False,
    )
    cron_expr: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)  # 'enable' | 'disable'
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    rule = relationship("Rule", back_populates="schedules")


class KickTarget(Base):
    """Таргет для тихого кика по таймауту в войсе."""

    __tablename__ = "kick_targets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    discord_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timeout_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class StackingPair(Base):
    """Пара пользователей для переноса в целевой канал при стакинге."""

    __tablename__ = "stacking_pairs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id_1: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_id_2: Mapped[int] = mapped_column(BigInteger, nullable=False)
    target_channel_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("uq_stacking_pairs_user_ids", "user_id_1", "user_id_2", unique=True),
    )
