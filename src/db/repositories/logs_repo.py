"""
Репозиторий логов действий (action_logs). Асинхронные операции через asyncpg.
"""
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


async def log_action(
    pool: asyncpg.Pool,
    rule_id: Optional[int],
    discord_id: int,
    action_type: str,
    channel_id: Optional[int] = None,
    details: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Записать выполненное действие."""
    now = datetime.now(timezone.utc)
    query = """
        INSERT INTO action_logs (rule_id, discord_id, action_type, channel_id, details, executed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, rule_id, discord_id, action_type, channel_id, details, executed_at
    """
    row = await pool.fetchrow(
        query,
        rule_id,
        discord_id,
        action_type,
        channel_id,
        details or {},
        now,
    )
    return _row_to_dict(row)


async def get_logs(
    pool: asyncpg.Pool,
    filters: Optional[dict[str, Any]] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """
    Выборка логов с фильтрами и пагинацией.
    filters: discord_id, rule_id, action_type, date_from, date_to (datetime или ISO строка).
    """
    filters = filters or {}
    conditions = []
    args: list[Any] = []
    n = 1

    if "discord_id" in filters and filters["discord_id"] is not None:
        conditions.append(f"discord_id = ${n}")
        args.append(filters["discord_id"])
        n += 1
    if "rule_id" in filters and filters["rule_id"] is not None:
        conditions.append(f"rule_id = ${n}")
        args.append(filters["rule_id"])
        n += 1
    if "action_type" in filters and filters["action_type"] is not None:
        conditions.append(f"action_type = ${n}")
        args.append(filters["action_type"])
        n += 1
    if "date_from" in filters and filters["date_from"] is not None:
        conditions.append(f"executed_at >= ${n}")
        args.append(filters["date_from"])
        n += 1
    if "date_to" in filters and filters["date_to"] is not None:
        conditions.append(f"executed_at <= ${n}")
        args.append(filters["date_to"])
        n += 1

    where_clause = (" AND " + " AND ".join(conditions)) if conditions else ""
    args.extend([limit, offset])
    limit_pos = len(args) - 1
    offset_pos = len(args)

    query = f"""
        SELECT id, rule_id, discord_id, action_type, channel_id, details, executed_at
        FROM action_logs
        {where_clause}
        ORDER BY executed_at DESC
        LIMIT ${limit_pos} OFFSET ${offset_pos}
    """
    rows = await pool.fetch(query, *args)
    return [_row_to_dict(r) for r in rows]
