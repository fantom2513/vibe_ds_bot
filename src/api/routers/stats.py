"""
Роутер статистики по action_logs (опционально).
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import StatsOverviewResponse, UserStatsResponse

router = APIRouter()


@router.get("/stats/overview", response_model=StatsOverviewResponse)
async def stats_overview(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> StatsOverviewResponse:
    """Агрегаты по всем логам: общее число действий и по типам."""
    total_row = await pool.fetchrow(
        "SELECT COUNT(*)::int AS cnt FROM action_logs"
    )
    total_actions = total_row["cnt"] if total_row else 0

    rows = await pool.fetch(
        """
        SELECT action_type, COUNT(*)::int AS cnt
        FROM action_logs
        WHERE action_type IS NOT NULL
        GROUP BY action_type
        """
    )
    actions_by_type = {r["action_type"]: r["cnt"] for r in rows}

    return StatsOverviewResponse(
        total_actions=total_actions,
        actions_by_type=actions_by_type,
    )


@router.get("/stats/user/{discord_id}", response_model=UserStatsResponse)
async def stats_user(
    discord_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> UserStatsResponse:
    """Агрегаты по логам для пользователя."""
    total_row = await pool.fetchrow(
        "SELECT COUNT(*)::int AS cnt FROM action_logs WHERE discord_id = $1",
        discord_id,
    )
    total_actions = total_row["cnt"] if total_row else 0

    rows = await pool.fetch(
        """
        SELECT action_type, COUNT(*)::int AS cnt
        FROM action_logs
        WHERE discord_id = $1 AND action_type IS NOT NULL
        GROUP BY action_type
        """,
        discord_id,
    )
    actions_by_type = {r["action_type"]: r["cnt"] for r in rows}

    return UserStatsResponse(
        discord_id=discord_id,
        total_actions=total_actions,
        actions_by_type=actions_by_type,
    )
