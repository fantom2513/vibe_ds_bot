"""
Роутеры mute-levels и mute-xp.
- CRUD для настройки уровней мута
- Лидерборд и профиль XP пользователей
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_current_user, get_db_pool
from src.api.schemas import (
    MuteLevelCreate,
    MuteLevelResponse,
    MuteLevelUpdate,
    MuteXPAdjust,
    MuteXPResponse,
)

router = APIRouter()


# ──────────────────────────────────────────────
# Mute Levels CRUD
# ──────────────────────────────────────────────

@router.get("/mute-levels", response_model=list[MuteLevelResponse])
async def list_mute_levels(
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[MuteLevelResponse]:
    """Список всех настроенных уровней мута."""
    rows = await pool.fetch(
        "SELECT level, xp_required, role_id, label, created_at FROM mute_levels ORDER BY level"
    )
    return [MuteLevelResponse(**dict(r)) for r in rows]


@router.post("/mute-levels", response_model=MuteLevelResponse, status_code=201)
async def create_mute_level(
    body: MuteLevelCreate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> MuteLevelResponse:
    """Создать новый уровень мута."""
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO mute_levels (level, xp_required, role_id, label)
            VALUES ($1, $2, $3, $4)
            RETURNING level, xp_required, role_id, label, created_at
            """,
            body.level,
            body.xp_required,
            body.role_id,
            body.label,
        )
        return MuteLevelResponse(**dict(row))
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail=f"Level {body.level} already exists")


@router.patch("/mute-levels/{level}", response_model=MuteLevelResponse)
async def update_mute_level(
    level: int,
    body: MuteLevelUpdate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> MuteLevelResponse:
    """Обновить уровень мута."""
    row = await pool.fetchrow(
        "SELECT level, xp_required, role_id, label, created_at FROM mute_levels WHERE level = $1",
        level,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Level not found")

    updates = []
    args: list = []
    n = 1
    if body.xp_required is not None:
        updates.append(f"xp_required = ${n}")
        args.append(body.xp_required)
        n += 1
    if body.role_id is not None:
        updates.append(f"role_id = ${n}")
        args.append(body.role_id)
        n += 1
    if body.label is not None:
        updates.append(f"label = ${n}")
        args.append(body.label)
        n += 1
    if not updates:
        return MuteLevelResponse(**dict(row))

    args.append(level)
    row = await pool.fetchrow(
        f"""
        UPDATE mute_levels SET {", ".join(updates)}
        WHERE level = ${n}
        RETURNING level, xp_required, role_id, label, created_at
        """,
        *args,
    )
    return MuteLevelResponse(**dict(row))


@router.delete("/mute-levels/{level}", status_code=204)
async def delete_mute_level(
    level: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить уровень мута."""
    result = await pool.execute("DELETE FROM mute_levels WHERE level = $1", level)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Level not found")


# ──────────────────────────────────────────────
# Mute XP
# ──────────────────────────────────────────────

@router.get("/mute-xp/leaderboard", response_model=list[MuteXPResponse])
async def mute_xp_leaderboard(
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[MuteXPResponse]:
    """Топ-10 пользователей по XP мута."""
    rows = await pool.fetch(
        """
        SELECT discord_id, xp, level, total_mute_seconds, updated_at
        FROM mute_xp
        ORDER BY xp DESC
        LIMIT 10
        """
    )
    return [MuteXPResponse(**dict(r)) for r in rows]


@router.get("/mute-xp/{discord_id}", response_model=MuteXPResponse)
async def get_mute_xp(
    discord_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> MuteXPResponse:
    """XP конкретного пользователя."""
    row = await pool.fetchrow(
        "SELECT discord_id, xp, level, total_mute_seconds, updated_at FROM mute_xp WHERE discord_id = $1",
        discord_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User XP not found")
    return MuteXPResponse(**dict(row))


@router.patch("/mute-xp/{discord_id}", response_model=MuteXPResponse)
async def adjust_mute_xp(
    discord_id: int,
    body: MuteXPAdjust,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> MuteXPResponse:
    """Ручная корректировка XP пользователя (для дашборда)."""
    row = await pool.fetchrow(
        """
        INSERT INTO mute_xp (discord_id, xp, total_mute_seconds)
        VALUES ($1, $2, 0)
        ON CONFLICT (discord_id) DO UPDATE
        SET xp = $2, updated_at = NOW()
        RETURNING discord_id, xp, level, total_mute_seconds, updated_at
        """,
        discord_id,
        body.xp,
    )
    return MuteXPResponse(**dict(row))
