"""
Роутер дашборда: агрегация активных правил, последних логов, числа в войсе.
SSE endpoint для real-time обновлений.
"""
import asyncio
import json
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from src.api.deps import get_current_user, get_db_pool
from src.api.sse import broadcaster
from src.api.schemas import ActionLogResponse, DashboardResponse, RuleResponse
from src.db.repositories import logs_repo, rules_repo

router = APIRouter()

DASHBOARD_RECENT_LOGS_LIMIT = 20


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    _: Annotated[dict, Depends(get_current_user)],
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


@router.get("/dashboard/stream")
async def dashboard_stream(
    request: Request,
    _: Annotated[dict, Depends(get_current_user)],
) -> EventSourceResponse:
    """SSE endpoint: real-time события голосовых каналов и действий бота."""
    queue = broadcaster.subscribe()

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield {"data": json.dumps(event)}
                except asyncio.TimeoutError:
                    yield {"data": json.dumps({"type": "ping"})}
        finally:
            broadcaster.unsubscribe(queue)

    return EventSourceResponse(generator())
