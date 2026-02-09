"""
Трекер голосовых сессий: in-memory хранилище и запись в voice_sessions.
Pool передаётся при вызове (dependency injection).
"""
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

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
) -> None:
    """
    Зарегистрировать вход в канал: добавить в память и INSERT в voice_sessions.
    """
    now = datetime.now(timezone.utc)
    _sessions[(discord_id, channel_id)] = now
    await pool.execute(
        """
        INSERT INTO voice_sessions (discord_id, channel_id, joined_at, left_at)
        VALUES ($1, $2, $3, NULL)
        """,
        discord_id,
        channel_id,
        now,
    )


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
