"""Хранение конфигурации отслеживаемых участников и загрузка их сессий."""
from datetime import datetime, time, timezone
from typing import Any

import asyncpg

from src.engine.tracking_report import Session

DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4]
DEFAULT_WORK_START = time(9)
DEFAULT_WORK_END = time(18)
DEFAULT_TIMEZONE = "Europe/Moscow"


def _row_to_dict(row: Any) -> dict[str, Any]:
    result = dict(row)
    for key in ("work_start", "work_end"):
        if isinstance(result.get(key), time):
            result[key] = result[key].isoformat()
    return result


async def create_tracked_member(pool: asyncpg.Pool, data: dict[str, Any]) -> dict[str, Any]:
    """Добавить участника или обновить сохранённое имя и настройки."""
    now = datetime.now(timezone.utc)
    row = await pool.fetchrow(
        """
        INSERT INTO tracked_members (
            discord_id, username, is_active, work_days, work_start, work_end, timezone, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
        ON CONFLICT (discord_id) DO UPDATE SET
            username = EXCLUDED.username,
            is_active = EXCLUDED.is_active,
            work_days = EXCLUDED.work_days,
            work_start = EXCLUDED.work_start,
            work_end = EXCLUDED.work_end,
            timezone = EXCLUDED.timezone,
            updated_at = EXCLUDED.updated_at
        RETURNING discord_id, username, is_active, work_days, work_start, work_end, timezone, created_at, updated_at
        """,
        data["discord_id"], data.get("username"), data.get("is_active", True),
        data.get("work_days", DEFAULT_WORK_DAYS), data.get("work_start", DEFAULT_WORK_START),
        data.get("work_end", DEFAULT_WORK_END), data.get("timezone", DEFAULT_TIMEZONE), now,
    )
    return _row_to_dict(row)


async def list_tracked_members(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    """Вернуть все настроенные профили отслеживания."""
    rows = await pool.fetch(
        """
        SELECT discord_id, username, is_active, work_days, work_start, work_end, timezone, created_at, updated_at
        FROM tracked_members
        ORDER BY username NULLS LAST, discord_id
        """
    )
    return [_row_to_dict(row) for row in rows]


async def load_report_sessions(
    pool: asyncpg.Pool,
    member_ids: list[int],
    period_start: datetime,
    period_end: datetime,
    now: datetime,
) -> list[Session]:
    """Вернуть сессии участников, пересекающиеся с периодом, включая текущие."""
    if not member_ids:
        return []
    rows = await pool.fetch(
        """
        SELECT discord_id, channel_id, joined_at, COALESCE(left_at, $4) AS left_at
        FROM voice_sessions
        WHERE discord_id = ANY($1::bigint[])
          AND joined_at < $3
          AND COALESCE(left_at, $4) > $2
        ORDER BY joined_at
        """,
        member_ids, period_start, period_end, now,
    )
    return [Session(row["discord_id"], row["channel_id"], row["joined_at"], row["left_at"]) for row in rows]
