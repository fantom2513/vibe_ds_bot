"""
Роутер логов действий.
"""
from typing import Annotated, Optional

import asyncpg
from fastapi import APIRouter, Depends, Query

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import ActionLogResponse
from src.db.repositories import logs_repo

router = APIRouter()


@router.get("/logs", response_model=list[ActionLogResponse])
async def list_logs(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    discord_id: Optional[int] = Query(None),
    rule_id: Optional[int] = Query(None),
    action_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO datetime"),
    date_to: Optional[str] = Query(None, description="ISO datetime"),
) -> list[ActionLogResponse]:
    """Список логов с фильтрами и пагинацией."""
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
