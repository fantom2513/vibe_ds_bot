"""
Роутер дашборда: агрегация активных правил, последних логов, числа в войсе.
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import ActionLogResponse, DashboardResponse, RuleResponse
from src.db.repositories import logs_repo, rules_repo

router = APIRouter()

DASHBOARD_RECENT_LOGS_LIMIT = 20


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> DashboardResponse:
    """
    Агрегация: активные правила, последние N логов, число активных голосовых сессий.
    """
    active_rules = await rules_repo.get_active_rules(pool, channel_id=None)
    recent_logs = await logs_repo.get_logs(
        pool,
        filters=None,
        limit=DASHBOARD_RECENT_LOGS_LIMIT,
        offset=0,
    )
    row = await pool.fetchrow(
        "SELECT COUNT(*)::int AS cnt FROM voice_sessions WHERE left_at IS NULL"
    )
    voice_online_count = row["cnt"] if row else 0

    return DashboardResponse(
        active_rules=[RuleResponse(**r) for r in active_rules],
        recent_logs=[ActionLogResponse(**r) for r in recent_logs],
        voice_online_count=voice_online_count,
    )
