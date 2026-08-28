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


def _to_time(value: str | time) -> time:
    return value if isinstance(value, time) else time.fromisoformat(value)


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
        data.get("work_days", DEFAULT_WORK_DAYS), _to_time(data.get("work_start", DEFAULT_WORK_START)),
        _to_time(data.get("work_end", DEFAULT_WORK_END)), data.get("timezone", DEFAULT_TIMEZONE), now,
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


async def update_tracked_member(pool: asyncpg.Pool, discord_id: int, data: dict[str, Any]) -> dict[str, Any] | None:
    """Обновить только переданные параметры отслеживаемого участника."""
    fields = list(data)
    if not fields:
        row = await pool.fetchrow("SELECT * FROM tracked_members WHERE discord_id = $1", discord_id)
        return _row_to_dict(row) if row else None
    assignments = ", ".join(f"{field} = ${index}" for index, field in enumerate(fields, start=2))
    row = await pool.fetchrow(
        f"""
        UPDATE tracked_members SET {assignments}, updated_at = $1
        WHERE discord_id = ${len(fields) + 2}
        RETURNING discord_id, username, is_active, work_days, work_start, work_end, timezone, created_at, updated_at
        """,
        datetime.now(timezone.utc), *[
            _to_time(data[field]) if field in {"work_start", "work_end"} and data[field] is not None else data[field]
            for field in fields
        ], discord_id,
    )
    return _row_to_dict(row) if row else None


async def delete_tracked_member(pool: asyncpg.Pool, discord_id: int) -> bool:
    result = await pool.execute("DELETE FROM tracked_members WHERE discord_id = $1", discord_id)
    return result == "DELETE 1"


async def get_tracking_settings(pool: asyncpg.Pool) -> dict[str, Any]:
    row = await pool.fetchrow("SELECT report_channel_id FROM tracking_settings WHERE id = 1")
    return dict(row) if row else {"report_channel_id": None}


async def set_report_channel(pool: asyncpg.Pool, report_channel_id: int | None) -> dict[str, Any]:
    row = await pool.fetchrow(
        """
        INSERT INTO tracking_settings (id, report_channel_id, updated_at) VALUES (1, $1, $2)
        ON CONFLICT (id) DO UPDATE SET report_channel_id = EXCLUDED.report_channel_id, updated_at = EXCLUDED.updated_at
        RETURNING report_channel_id
        """,
        report_channel_id, datetime.now(timezone.utc),
    )
    return dict(row)


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
