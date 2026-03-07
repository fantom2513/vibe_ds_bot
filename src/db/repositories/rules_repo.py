"""
Репозиторий правил (rules). Асинхронные операции через asyncpg.
"""
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """Преобразует запись asyncpg в словарь."""
    return {k: row[k] for k in row.keys()}


_RULE_COLUMNS = """
    id, name, description, is_active, is_dry_run, target_list, channel_ids,
    max_time_sec, action_type, action_params, schedule_cron, schedule_tz,
    priority, created_at, updated_at
"""


async def get_rules(
    pool: asyncpg.Pool,
    active_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Выборка всех правил (для API). При active_only=True — только is_active.
    ORDER BY priority.
    """
    if active_only:
        query = f"""
            SELECT {_RULE_COLUMNS}
            FROM rules
            WHERE is_active
            ORDER BY priority
        """
    else:
        query = f"""
            SELECT {_RULE_COLUMNS}
            FROM rules
            ORDER BY priority
        """
    rows = await pool.fetch(query)
    return [_row_to_dict(r) for r in rows]


async def get_all_active_rules(pool: asyncpg.Pool) -> list[dict[str, Any]]:
    """
    Все активные правила (для планировщика overtime). ORDER BY priority.
    """
    query = f"""
        SELECT {_RULE_COLUMNS}
        FROM rules
        WHERE is_active
        ORDER BY priority
    """
    rows = await pool.fetch(query)
    return [_row_to_dict(r) for r in rows]


async def get_active_rules(
    pool: asyncpg.Pool,
    channel_id: Optional[int] = None,
) -> list[dict[str, Any]]:
    """
    Выборка активных правил, применимых к каналу (или всех с channel_ids IS NULL при channel_id=None).
    ORDER BY priority.
    """
    if channel_id is None:
        query = f"""
            SELECT {_RULE_COLUMNS}
            FROM rules
            WHERE is_active AND channel_ids IS NULL
            ORDER BY priority
        """
        rows = await pool.fetch(query)
    else:
        query = f"""
            SELECT {_RULE_COLUMNS}
            FROM rules
            WHERE is_active AND (channel_ids IS NULL OR $1 = ANY(channel_ids))
            ORDER BY priority
        """
        rows = await pool.fetch(query, channel_id)
    return [_row_to_dict(r) for r in rows]


async def get_rule_by_id(
    pool: asyncpg.Pool,
    rule_id: int,
) -> Optional[dict[str, Any]]:
    """Получить правило по id."""
    query = f"""
        SELECT {_RULE_COLUMNS}
        FROM rules
        WHERE id = $1
    """
    row = await pool.fetchrow(query, rule_id)
    return _row_to_dict(row) if row else None


async def create_rule(
    pool: asyncpg.Pool,
    data: dict[str, Any],
) -> dict[str, Any]:
    """
    Создать правило. data: name (обяз.), description, is_active, is_dry_run, target_list,
    channel_ids, max_time_sec, action_type (обяз.), action_params, schedule_cron,
    schedule_tz, priority. created_at/updated_at проставляются автоматически.
    """
    now = datetime.now(timezone.utc)
    query = """
        INSERT INTO rules (
            name, description, is_active, is_dry_run, target_list, channel_ids,
            max_time_sec, action_type, action_params, schedule_cron, schedule_tz,
            priority, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, name, description, is_active, is_dry_run, target_list, channel_ids,
                  max_time_sec, action_type, action_params, schedule_cron, schedule_tz,
                  priority, created_at, updated_at
    """
    row = await pool.fetchrow(
        query,
        data.get("name", ""),
        data.get("description"),
        data.get("is_active", True),
        data.get("is_dry_run", False),
        data.get("target_list"),
        data.get("channel_ids"),
        data.get("max_time_sec"),
        data.get("action_type", ""),
        data.get("action_params") or {},
        data.get("schedule_cron"),
        data.get("schedule_tz", "UTC"),
        data.get("priority", 0),
        data.get("created_at") or now,
        data.get("updated_at") or now,
    )
    return _row_to_dict(row)


async def update_rule(
    pool: asyncpg.Pool,
    rule_id: int,
    data: dict[str, Any],
) -> Optional[dict[str, Any]]:
    """
    Обновить правило. data может содержать любые поля таблицы (кроме id).
    updated_at обновляется автоматически.
    """
    current = await get_rule_by_id(pool, rule_id)
    if not current:
        return None

    now = datetime.now(timezone.utc)
    merged = {**current, **data, "updated_at": now}
    merged.pop("id", None)

    query = """
        UPDATE rules SET
            name = $1, description = $2, is_active = $3, is_dry_run = $4, target_list = $5,
            channel_ids = $6, max_time_sec = $7, action_type = $8, action_params = $9,
            schedule_cron = $10, schedule_tz = $11, priority = $12, updated_at = $13
        WHERE id = $14
        RETURNING id, name, description, is_active, is_dry_run, target_list, channel_ids,
                  max_time_sec, action_type, action_params, schedule_cron, schedule_tz,
                  priority, created_at, updated_at
    """
    row = await pool.fetchrow(
        query,
        merged.get("name"),
        merged.get("description"),
        merged.get("is_active"),
        merged.get("is_dry_run", False),
        merged.get("target_list"),
        merged.get("channel_ids"),
        merged.get("max_time_sec"),
        merged.get("action_type"),
        merged.get("action_params") or {},
        merged.get("schedule_cron"),
        merged.get("schedule_tz"),
        merged.get("priority"),
        now,
        rule_id,
    )
    return _row_to_dict(row) if row else None


async def delete_rule(
    pool: asyncpg.Pool,
    rule_id: int,
) -> bool:
    """Удалить правило по id. Возвращает True, если удалена хотя бы одна строка."""
    result = await pool.execute("DELETE FROM rules WHERE id = $1", rule_id)
    return result.split()[-1] == "1"
