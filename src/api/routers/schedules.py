"""
Роутер расписаний (schedules).
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import ScheduleCreate, ScheduleResponse
from src.db import database
from src.db.repositories import schedules_repo

router = APIRouter()


@router.get("/schedules", response_model=list[ScheduleResponse])
async def list_schedules(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[ScheduleResponse]:
    """Список активных расписаний."""
    rows = await schedules_repo.get_active_schedules(pool)
    return [ScheduleResponse(**r) for r in rows]


@router.post("/schedules", response_model=ScheduleResponse)
async def create_schedule(
    body: ScheduleCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> ScheduleResponse:
    """Создать расписание для правила."""
    row = await schedules_repo.create_schedule(
        pool,
        body.rule_id,
        body.cron_expr,
        body.action,
        timezone=body.timezone,
    )
    await database.notify_config_changed(pool)
    return ScheduleResponse(**row)


@router.delete("/schedules/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить расписание."""
    deleted = await schedules_repo.delete_schedule(pool, schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await database.notify_config_changed(pool)
