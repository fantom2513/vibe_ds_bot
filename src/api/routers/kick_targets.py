"""
Роутер kick-targets: CRUD для таргетов тихого кика по таймауту.
"""
from datetime import datetime, timezone
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import KickTargetCreate, KickTargetResponse, KickTargetUpdate

router = APIRouter(prefix="/kick-targets", tags=["kick-targets"])


def _row_to_response(row: asyncpg.Record) -> KickTargetResponse:
    return KickTargetResponse(
        id=row["id"],
        discord_id=row["discord_id"],
        username=row["username"],
        timeout_sec=row["timeout_sec"],
        is_active=row["is_active"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=list[KickTargetResponse])
async def list_kick_targets(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[KickTargetResponse]:
    """Список всех таргетов кика по таймауту."""
    rows = await pool.fetch(
        "SELECT id, discord_id, username, timeout_sec, is_active, created_at, updated_at FROM kick_targets ORDER BY id"
    )
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=KickTargetResponse, status_code=201)
async def create_kick_target(
    body: KickTargetCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """Добавить таргет. 409 при дубликате discord_id."""
    try:
        now = datetime.now(timezone.utc)
        row = await pool.fetchrow(
            """
            INSERT INTO kick_targets (discord_id, username, timeout_sec, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, true, $4, $4)
            RETURNING id, discord_id, username, timeout_sec, is_active, created_at, updated_at
            """,
            body.discord_id,
            body.username,
            body.timeout_sec,
            now,
        )
        return _row_to_response(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="Target with this discord_id already exists")


@router.get("/{discord_id}", response_model=KickTargetResponse)
async def get_kick_target(
    discord_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """Получить таргет по discord_id."""
    row = await pool.fetchrow(
        "SELECT id, discord_id, username, timeout_sec, is_active, created_at, updated_at FROM kick_targets WHERE discord_id = $1",
        discord_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Kick target not found")
    return _row_to_response(row)


@router.patch("/{discord_id}", response_model=KickTargetResponse)
async def update_kick_target(
    discord_id: int,
    body: KickTargetUpdate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> KickTargetResponse:
    """Обновить таргет (timeout_sec, is_active, username)."""
    row = await pool.fetchrow(
        "SELECT id, discord_id, username, timeout_sec, is_active, created_at, updated_at FROM kick_targets WHERE discord_id = $1",
        discord_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Kick target not found")

    updates = []
    args = []
    n = 1
    if body.timeout_sec is not None:
        updates.append(f"timeout_sec = ${n}")
        args.append(body.timeout_sec)
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
        RETURNING id, discord_id, username, timeout_sec, is_active, created_at, updated_at
        """,
        *args,
    )
    return _row_to_response(row)


@router.delete("/{discord_id}", status_code=204)
async def delete_kick_target(
    discord_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить таргет по discord_id."""
    result = await pool.execute("DELETE FROM kick_targets WHERE discord_id = $1", discord_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Kick target not found")
