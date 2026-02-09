"""
Роутер stacking-pairs: CRUD для пар стакинга.
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import StackingPairCreate, StackingPairResponse

router = APIRouter(prefix="/stacking-pairs", tags=["stacking-pairs"])


def _row_to_response(row: asyncpg.Record) -> StackingPairResponse:
    return StackingPairResponse(
        id=row["id"],
        user_id_1=row["user_id_1"],
        user_id_2=row["user_id_2"],
        target_channel_id=row["target_channel_id"],
        is_active=row["is_active"],
        created_at=row["created_at"],
    )


def _normalize_pair(user_id_1: int, user_id_2: int) -> tuple[int, int]:
    """Меньший id первым для unique-индекса."""
    if user_id_1 <= user_id_2:
        return user_id_1, user_id_2
    return user_id_2, user_id_1


@router.get("", response_model=list[StackingPairResponse])
async def list_stacking_pairs(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[StackingPairResponse]:
    """Список всех пар стакинга."""
    rows = await pool.fetch(
        "SELECT id, user_id_1, user_id_2, target_channel_id, is_active, created_at FROM stacking_pairs ORDER BY id"
    )
    return [_row_to_response(r) for r in rows]


@router.post("", response_model=StackingPairResponse, status_code=201)
async def create_stacking_pair(
    body: StackingPairCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> StackingPairResponse:
    """Добавить пару. Порядок ID нормализуется (меньший первым). 409 при дубликате пары."""
    uid1, uid2 = _normalize_pair(body.user_id_1, body.user_id_2)
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO stacking_pairs (user_id_1, user_id_2, target_channel_id, is_active, created_at)
            VALUES ($1, $2, $3, true, NOW())
            RETURNING id, user_id_1, user_id_2, target_channel_id, is_active, created_at
            """,
            uid1,
            uid2,
            body.target_channel_id,
        )
        return _row_to_response(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="This pair already exists")


@router.patch("/{pair_id}/toggle", response_model=StackingPairResponse)
async def toggle_stacking_pair(
    pair_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> StackingPairResponse:
    """Переключить is_active для пары."""
    row = await pool.fetchrow(
        """
        UPDATE stacking_pairs SET is_active = NOT is_active
        WHERE id = $1
        RETURNING id, user_id_1, user_id_2, target_channel_id, is_active, created_at
        """,
        pair_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Stacking pair not found")
    return _row_to_response(row)


@router.delete("/{pair_id}", status_code=204)
async def delete_stacking_pair(
    pair_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить пару по id."""
    result = await pool.execute("DELETE FROM stacking_pairs WHERE id = $1", pair_id)
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Stacking pair not found")
