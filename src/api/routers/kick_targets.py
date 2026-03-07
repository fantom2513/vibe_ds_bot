"""
Роутер kick-targets: CRUD для таргетов тихого кика по таймауту.
"""
from datetime import datetime, timezone
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_current_user, get_db_pool
from src.api.schemas import KickTargetCreate, KickTargetResponse, KickTargetUpdate

router = APIRouter(prefix="/kick-targets", tags=["kick-targets"])

_SELECT = "SELECT id, discord_id, username, timeout_sec, max_timeout_sec, is_active, created_at, updated_at FROM kick_targets"


def _row_to_response(row: asyncpg.Record) -> KickTargetResponse:
    return KickTargetResponse(
        id=row["id"],
        discord_id=row["discord_id"],
        username=row["username"],
        timeout_sec=row["timeout_sec"],
        max_timeout_sec=row["max_timeout_sec"],
        is_active=row["is_active"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=list[KickTargetResponse])
async def list_kick_targets(
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[KickTargetResponse]:
    """
    Список всех пользователей с таймаутом кика.

    Бот автоматически выкидывает пользователя из войса, если он сидит дольше заданного времени.
    Если задан `max_timeout_sec` — таймаут рандомизируется в диапазоне `[timeout_sec, max_timeout_sec]`
    при каждом новом входе в канал.
    """
    rows = await pool.fetch(f"{_SELECT} ORDER BY id")
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=KickTargetResponse, status_code=201)
async def create_kick_target(
    body: KickTargetCreate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """
    Добавить пользователя в список автокика по таймауту.

    - **discord_id** — Discord ID пользователя (ПКМ на пользователе → Скопировать ID)
    - **timeout_sec** — минимальное время в войсе в секундах перед киком (по умолчанию 1800 = 30 мин)
    - **max_timeout_sec** — если задан, таймаут будет случайным от `timeout_sec` до `max_timeout_sec`

    Пример (рандомный кик от 30 до 90 минут):
    ```json
    {
      "discord_id": 123456789012345678,
      "timeout_sec": 1800,
      "max_timeout_sec": 5400
    }
    ```

    409 если пользователь уже добавлен.
    """
    try:
        now = datetime.now(timezone.utc)
        row = await pool.fetchrow(
            """
            INSERT INTO kick_targets (discord_id, username, timeout_sec, max_timeout_sec, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, true, $5, $5)
            RETURNING id, discord_id, username, timeout_sec, max_timeout_sec, is_active, created_at, updated_at
            """,
            body.discord_id,
            body.username,
            body.timeout_sec,
            body.max_timeout_sec,
            now,
        )
        return _row_to_response(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Target with this discord_id already exists")


@router.get("/{discord_id}", response_model=KickTargetResponse)
async def get_kick_target(
    discord_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """Получить настройки таймаута кика для пользователя по его Discord ID."""
    row = await pool.fetchrow(f"{_SELECT} WHERE discord_id = $1", discord_id)
    if not row:
        raise HTTPException(status_code=404, detail="Kick target not found")
    return _row_to_response(row)


@router.patch("/{discord_id}", response_model=KickTargetResponse)
async def update_kick_target(
    discord_id: int,
    body: KickTargetUpdate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """
    Обновить настройки таймаута кика для пользователя.

    Передавай только поля, которые нужно изменить. Например, чтобы отключить кик:
    ```json
    {"is_active": false}
    ```
    Или изменить диапазон:
    ```json
    {"timeout_sec": 3600, "max_timeout_sec": 7200}
    ```
    """
    row = await pool.fetchrow(f"{_SELECT} WHERE discord_id = $1", discord_id)
    if not row:
        raise HTTPException(status_code=404, detail="Kick target not found")

    updates = []
    args = []
    n = 1
    if body.timeout_sec is not None:
        updates.append(f"timeout_sec = ${n}")
        args.append(body.timeout_sec)
        n += 1
    if body.max_timeout_sec is not None:
        updates.append(f"max_timeout_sec = ${n}")
        args.append(body.max_timeout_sec)
        n += 1
    if body.is_active is not None:
        updates.append(f"is_active = ${n}")
        args.append(body.is_active)
        n += 1
    if body.username is not None:
        updates.append(f"username = ${n}")
        args.append(body.username)
        n += 1
    if not updates:
        return _row_to_response(row)
    updates.append("updated_at = NOW()")
    args.append(discord_id)
    row = await pool.fetchrow(
        f"""
        UPDATE kick_targets SET {", ".join(updates)}
        WHERE discord_id = ${n}
        RETURNING id, discord_id, username, timeout_sec, max_timeout_sec, is_active, created_at, updated_at
        """,
        *args,
    )
    return _row_to_response(row)


@router.delete("/{discord_id}", status_code=204)
async def delete_kick_target(
    discord_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Полностью удалить пользователя из списка автокика по Discord ID."""
    result = await pool.execute("DELETE FROM kick_targets WHERE discord_id = $1", discord_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Kick target not found")
