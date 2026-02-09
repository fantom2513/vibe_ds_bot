"""
Репозиторий расписаний (schedules). Асинхронные операции через asyncpg.
"""
from datetime import datetime, timezone
from typing import Any, Literal, Optional

import asyncpg

ScheduleAction = Literal["enable", "disable"]


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


async def get_active_schedules(
    pool: asyncpg.Pool,
) -> list[dict[str, Any]]:
    """Список активных расписаний."""
    query = """
        SELECT id, rule_id, cron_expr, action, timezone, is_active, created_at
        FROM schedules
        WHERE is_active
        ORDER BY id
    """
    rows = await pool.fetch(query)
    return [_row_to_dict(r) for r in rows]


async def create_schedule(
    pool: asyncpg.Pool,
    rule_id: int,
    cron_expr: str,
    action: ScheduleAction,
    timezone: str = "UTC",
) -> dict[str, Any]:
    """Создать расписание для правила."""
    now = datetime.now(timezone.utc)
    query = """
        INSERT INTO schedules (rule_id, cron_expr, action, timezone, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, $5)
        RETURNING id, rule_id, cron_expr, action, timezone, is_active, created_at
    """
    row = await pool.fetchrow(query, rule_id, cron_expr, action, timezone, now)
    return _row_to_dict(row)


async def delete_schedule(
    pool: asyncpg.Pool,
    schedule_id: int,
) -> bool:
    """Удалить расписание по id. Возвращает True, если удалена хотя бы одна строка."""
    result = await pool.execute("DELETE FROM schedules WHERE id = $1", schedule_id)
    return result.split()[-1] == "1"
