"""
Репозиторий статистики. Агрегации по voice_sessions и action_logs.
"""
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg


async def get_weekly_stats(pool: asyncpg.Pool) -> dict[str, Any]:
    """
    Статистика за последние 7 дней:
    - total_sessions: количество сессий
    - total_seconds: суммарное время в войсе (только завершённые сессии)
    - top_user_id: discord_id пользователя с наибольшим суммарным временем
    - total_actions: количество записей в action_logs за 7 дней
    """
    sessions_query = """
        SELECT
            COUNT(*) AS total_sessions,
            SUM(EXTRACT(EPOCH FROM (left_at - joined_at)))
                FILTER (WHERE left_at IS NOT NULL) AS total_seconds,
            (
                SELECT discord_id FROM voice_sessions
                WHERE joined_at >= NOW() - INTERVAL '7 days'
                GROUP BY discord_id
                ORDER BY SUM(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at))) DESC
                LIMIT 1
            ) AS top_user_id
        FROM voice_sessions
        WHERE joined_at >= NOW() - INTERVAL '7 days'
    """
    actions_query = """
        SELECT COUNT(*) AS total_actions
        FROM action_logs
        WHERE executed_at >= NOW() - INTERVAL '7 days'
    """

    row = await pool.fetchrow(sessions_query)
    actions_row = await pool.fetchrow(actions_query)

    return {
        "total_sessions": row["total_sessions"] or 0,
        "total_seconds": row["total_seconds"] or 0,
        "top_user_id": row["top_user_id"],
        "total_actions": actions_row["total_actions"] or 0,
    }


async def get_today_stats(pool: asyncpg.Pool) -> dict[str, Any]:
    """
    Статистика за сегодня (UTC): общее количество действий и разбивка по типам.
    """
    query = """
        SELECT action_type, COUNT(*) AS cnt
        FROM action_logs
        WHERE executed_at >= NOW()::date
        GROUP BY action_type
    """
    rows = await pool.fetch(query)
    by_type = {r["action_type"]: r["cnt"] for r in rows}
    return {
        "total_actions": sum(by_type.values()),
        "actions_by_type": by_type,
    }


async def get_user_stats(pool: asyncpg.Pool, discord_id: int) -> dict[str, Any]:
    """
    Статистика по пользователю за последние 30 дней:
    - total_voice_seconds: суммарное время в войсе
    - total_actions: количество действий над пользователем
    - actions_by_type: разбивка по типам действий
    """
    voice_query = """
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at))), 0)
               AS total_seconds
        FROM voice_sessions
        WHERE discord_id = $1
          AND joined_at >= NOW() - INTERVAL '30 days'
    """
    actions_query = """
        SELECT action_type, COUNT(*) AS cnt
        FROM action_logs
        WHERE discord_id = $1
          AND executed_at >= NOW() - INTERVAL '30 days'
        GROUP BY action_type
    """
    voice_row = await pool.fetchrow(voice_query, discord_id)
    action_rows = await pool.fetch(actions_query, discord_id)

    by_type = {r["action_type"]: r["cnt"] for r in action_rows}
    return {
        "total_voice_seconds": int(voice_row["total_seconds"] or 0),
        "total_actions": sum(by_type.values()),
        "actions_by_type": by_type,
    }
