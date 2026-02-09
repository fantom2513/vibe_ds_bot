"""
Репозиторий списков пользователей (user_lists): whitelist / blacklist.
Асинхронные операции через asyncpg.
"""
from datetime import datetime, timezone
from typing import Any, Literal, Optional

import asyncpg

ListType = Literal["whitelist", "blacklist"]


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {k: row[k] for k in row.keys()}


async def get_user_lists(
    pool: asyncpg.Pool,
    list_type: ListType,
) -> list[dict[str, Any]]:
    """Список записей по типу (whitelist или blacklist)."""
    query = """
        SELECT id, discord_id, username, list_type, reason, created_at, updated_at
        FROM user_lists
        WHERE list_type = $1
        ORDER BY discord_id
    """
    rows = await pool.fetch(query, list_type)
    return [_row_to_dict(r) for r in rows]


async def is_in_list(
    pool: asyncpg.Pool,
    discord_id: int,
    list_type: str,
) -> bool:
    """Проверить, есть ли пользователь в указанном списке."""
    query = """
        SELECT 1 FROM user_lists
        WHERE discord_id = $1 AND list_type = $2
        LIMIT 1
    """
    row = await pool.fetchrow(query, discord_id, list_type)
    return row is not None


async def add_user(
    pool: asyncpg.Pool,
    discord_id: int,
    list_type: str,
    username: Optional[str] = None,
    reason: Optional[str] = None,
) -> dict[str, Any]:
    """
    Добавить пользователя в список. При конфликте (discord_id, list_type) — обновить.
    """
    now = datetime.now(timezone.utc)
    query = """
        INSERT INTO user_lists (discord_id, username, list_type, reason, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (discord_id, list_type)
        DO UPDATE SET username = COALESCE(EXCLUDED.username, user_lists.username),
                      reason = COALESCE(EXCLUDED.reason, user_lists.reason),
                      updated_at = EXCLUDED.updated_at
        RETURNING id, discord_id, username, list_type, reason, created_at, updated_at
    """
    row = await pool.fetchrow(
        query,
        discord_id,
        username,
        list_type,
        reason,
        now,
        now,
    )
    return _row_to_dict(row)


async def remove_user(
    pool: asyncpg.Pool,
    discord_id: int,
    list_type: str,
) -> bool:
    """Удалить пользователя из списка. Возвращает True, если удалена хотя бы одна строка."""
    result = await pool.execute(
        "DELETE FROM user_lists WHERE discord_id = $1 AND list_type = $2",
        discord_id,
        list_type,
    )
    return result.split()[-1] == "1"


async def bulk_add(
    pool: asyncpg.Pool,
    entries: list[dict[str, Any]],
) -> int:
    """
    Массовое добавление. Каждый элемент: discord_id (обяз.), list_type (обяз.),
    username (опц.), reason (опц.). Возвращает количество обработанных записей.
    """
    if not entries:
        return 0
    now = datetime.now(timezone.utc)
    count = 0
    for e in entries:
        query = """
            INSERT INTO user_lists (discord_id, username, list_type, reason, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (discord_id, list_type)
            DO UPDATE SET username = COALESCE(EXCLUDED.username, user_lists.username),
                          reason = COALESCE(EXCLUDED.reason, user_lists.reason),
                          updated_at = EXCLUDED.updated_at
        """
        await pool.execute(
            query,
            e["discord_id"],
            e.get("username"),
            e["list_type"],
            e.get("reason"),
            now,
            now,
        )
        count += 1
    return count
