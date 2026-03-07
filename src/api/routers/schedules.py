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
    """
    Список активных расписаний.

    Расписание автоматически включает (`enable`) или выключает (`disable`) правило по cron-выражению.
    Например, можно включать правило кика только в ночные часы.
    """
    rows = await schedules_repo.get_active_schedules(pool)
    return [ScheduleResponse(**r) for r in rows]


@router.post("/schedules", response_model=ScheduleResponse)
async def create_schedule(
    body: ScheduleCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> ScheduleResponse:
    """
    Создать расписание для правила.

    - **rule_id** — ID правила, которое нужно включать/выключать
    - **action** — `enable` (включить правило) или `disable` (выключить)
    - **cron_expr** — cron-выражение (5 полей: минута час день месяц день_недели)
    - **timezone** — часовой пояс, например `Europe/Moscow`

    Примеры cron-выражений:
    - `0 22 * * *` — каждый день в 22:00
    - `0 8 * * 1-5` — каждый будний день в 08:00
    - `0 0 * * 6,0` — каждую субботу и воскресенье в 00:00

    Пример: включать правило кика каждый день в 22:00 (отбой):
    ```json
    {
      "rule_id": 1,
      "action": "enable",
      "cron_expr": "0 22 * * *",
      "timezone": "Europe/Moscow"
    }
    ```
    """
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
    """Удалить расписание по ID."""
    deleted = await schedules_repo.delete_schedule(pool, schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")
    await database.notify_config_changed(pool)
