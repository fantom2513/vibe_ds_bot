"""
Роутер логов действий.
"""
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Query

from src.api.deps import get_current_user, get_db_pool
from src.api.schemas import ActionLogResponse
from src.db.repositories import logs_repo

router = APIRouter()


@router.get("/logs", response_model=list[ActionLogResponse])
async def list_logs(
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
    limit: int = Query(default=50, ge=1, le=500, description="Количество записей (макс. 500)"),
    offset: int = Query(default=0, ge=0, description="Смещение для пагинации"),
    discord_id: Optional[int] = Query(None, description="Фильтр по Discord ID пользователя"),
    rule_id: Optional[int] = Query(None, description="Фильтр по ID правила"),
    action_type: Optional[str] = Query(None, description="Фильтр по типу действия: kick, mute, unmute, move, kick_timeout, pair_move"),
    date_from: Optional[str] = Query(None, description="Начало периода (ISO 8601, например 2026-03-01T00:00:00Z)"),
    date_to: Optional[str] = Query(None, description="Конец периода (ISO 8601, например 2026-03-07T23:59:59Z)"),
) -> list[ActionLogResponse]:
    """
    История всех действий бота с фильтрами и пагинацией.

    Типы действий (`action_type`):
    - `kick` — выброс из войса по правилу (blacklist/whitelist)
    - `mute` — заглушение по правилу
    - `unmute` — снятие заглушения
    - `move` — перемещение в другой канал по правилу
    - `kick_timeout` — выброс по истечении таймаута (`kick-targets`)
    - `pair_move` — автоматическое перемещение пары (`stacking-pairs`)
    """
    filters: dict = {
        "discord_id": discord_id,
        "rule_id": rule_id,
        "action_type": action_type,
    }
    if date_from:
        from datetime import datetime
        try:
            filters["date_from"] = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        except ValueError:
            pass
    if date_to:
        from datetime import datetime
        try:
            filters["date_to"] = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
        except ValueError:
            pass
    rows = await logs_repo.get_logs(pool, filters=filters, limit=limit, offset=offset)
    return [ActionLogResponse(**r) for r in rows]
