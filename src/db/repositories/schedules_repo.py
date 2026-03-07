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


async def get_schedule_by_id(
    pool: asyncpg.Pool,
    schedule_id: int,
) -> Optional[dict[str, Any]]:
    """Получить расписание по id. Возвращает None, если не найдено."""
    query = """
        SELECT id, rule_id, cron_expr, action, timezone, is_active, created_at
        FROM schedules
        WHERE id = $1
    """
    row = await pool.fetchrow(query, schedule_id)
    return _row_to_dict(row) if row else None


async def update_schedule(
    pool: asyncpg.Pool,
    schedule_id: int,
    data: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """
    Обновить поля расписания (cron_expr, action, timezone, is_active).
    Возвращает обновлённую запись или None, если расписание не найдено.
    """
    allowed = {"cron_expr", "action", "timezone", "is_active"}
    fields = {k: v for k, v in data.items() if k in allowed}
    if not fields:
        return await get_schedule_by_id(pool, schedule_id)

    assignments = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(fields))
    values = list(fields.values())
    query = f"""
        UPDATE schedules
        SET {assignments}
        WHERE id = $1
        RETURNING id, rule_id, cron_expr, action, timezone, is_active, created_at
    """
    row = await pool.fetchrow(query, schedule_id, *values)
    return _row_to_dict(row) if row else None
