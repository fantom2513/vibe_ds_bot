"""
Трекер голосовых сессий: in-memory хранилище и запись в voice_sessions.
Pool передаётся при вызове (dependency injection).
"""
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg
import discord

from src.utils.logging import get_logger

_log = get_logger("tracker")

# Ключ in-memory: (discord_id, channel_id), значение: joined_at (datetime)
_sessions: dict[tuple[int, int], datetime] = {}


def get_current_sessions() -> list[tuple[int, int, datetime]]:
    """
    Список активных сессий из памяти: (discord_id, channel_id, joined_at).
    """
    return [
        (discord_id, channel_id, joined_at)
        for (discord_id, channel_id), joined_at in _sessions.items()
    ]


async def start_session(
    pool: asyncpg.Pool,
    discord_id: int,
    channel_id: int,
    joined_at: Optional[datetime] = None,
) -> None:
    """
    Зарегистрировать вход в канал: добавить в память и INSERT в voice_sessions.
    Если joined_at передан — это путь восстановления (recovery): не INSERT в БД,
    только обновить in-memory состояние.
    """
    if joined_at is None:
        joined_at = datetime.now(timezone.utc)
        _sessions[(discord_id, channel_id)] = joined_at
        await pool.execute(
            """
            INSERT INTO voice_sessions (discord_id, channel_id, joined_at, left_at)
            VALUES ($1, $2, $3, NULL)
            """,
            discord_id,
            channel_id,
            joined_at,
        )
    else:
        # Recovery path: сессия уже открыта в БД, только восстанавливаем in-memory
        _sessions[(discord_id, channel_id)] = joined_at


async def end_session(
    pool: asyncpg.Pool,
    discord_id: int,
    channel_id: int,
) -> None:
    """
    Завершить сессию: UPDATE voice_sessions SET left_at = NOW() и удалить из памяти.
    """
    key = (discord_id, channel_id)
    if key not in _sessions:
        return
    del _sessions[key]
    await pool.execute(
        """
        UPDATE voice_sessions
        SET left_at = NOW()
        WHERE discord_id = $1 AND channel_id = $2 AND left_at IS NULL
        """,
        discord_id,
        channel_id,
    )


def _rule_applies_to_channel(rule: dict[str, Any], channel_id: int) -> bool:
    """Правило применяется к каналу, если channel_ids is None или channel_id в списке."""
    channel_ids = rule.get("channel_ids")
    if channel_ids is None:
        return True
    return channel_id in (channel_ids if isinstance(channel_ids, list) else [])


def _duration_seconds(joined_at: datetime) -> float:
    """Длительность в секундах от joined_at до сейчас."""
    now = datetime.now(timezone.utc)
    delta = now - (joined_at if joined_at.tzinfo else joined_at.replace(tzinfo=timezone.utc))
    return delta.total_seconds()


async def sync_from_guild(
    pool: asyncpg.Pool,
    guild: discord.Guild,
) -> None:
    """
    Восстановить in-memory сессии для пользователей, уже сидящих в голосовых каналах.
    Вызывается при on_ready и on_resumed.
    Не создаёт дублей: если сессия уже в памяти — пропускаем.
    Если открытая запись в voice_sessions есть в БД — восстанавливаем joined_at из неё.
    Если нет — вызываем start_session (INSERT новой записи).
    """
    recovered = 0
    for channel in guild.voice_channels:
        for member in channel.members:
            key = (member.id, channel.id)
            if key in _sessions:
                continue
            try:
                row = await pool.fetchrow(
                    """
                    SELECT joined_at FROM voice_sessions
                    WHERE discord_id = $1 AND channel_id = $2 AND left_at IS NULL
                    ORDER BY joined_at DESC
                    LIMIT 1
                    """,
                    member.id,
                    channel.id,
                )
            except Exception as e:
                _log.warning("tracker.sync_db_error", discord_id=member.id, error=str(e))
                continue
            if row:
                # Восстанавливаем из БД: реальное joined_at известно
                await start_session(pool, member.id, channel.id, joined_at=row["joined_at"])
            else:
                # Нет открытой записи в БД — создаём новую
                await start_session(pool, member.id, channel.id)
            recovered += 1
    _log.info("tracker.sync", recovered=recovered)


async def get_overtime_users(
    pool: asyncpg.Pool,
    rules: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Для каждой активной сессии и каждого правила с max_time_sec и подходящим channel_id
    вычислить длительность; если >= max_time_sec, добавить в результат элемент:
    {discord_id, channel_id, rule, overtime_seconds}.
    """
    result: list[dict[str, Any]] = []
    rules_with_time = [r for r in rules if r.get("max_time_sec") is not None]
    if not rules_with_time:
        return result

    for (discord_id, channel_id), joined_at in list(_sessions.items()):
        duration_sec = _duration_seconds(joined_at)
        for rule in rules_with_time:
            if not _rule_applies_to_channel(rule, channel_id):
                continue
            max_sec = rule["max_time_sec"]
            if duration_sec >= max_sec:
                overtime_seconds = int(duration_sec - max_sec)
                result.append({
                    "discord_id": discord_id,
                    "channel_id": channel_id,
                    "rule": rule,
                    "overtime_seconds": overtime_seconds,
                })
    return result
