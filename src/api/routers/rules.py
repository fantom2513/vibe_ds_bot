"""
Роутер правил: CRUD и toggle.
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_current_user, get_db_pool
from src.api.schemas import RuleCreate, RuleResponse, RuleUpdate
from src.db import database
from src.db.repositories import rules_repo

router = APIRouter()


@router.get("/rules", response_model=list[RuleResponse])
async def list_rules(
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[RuleResponse]:
    """
    Список всех правил (активных и неактивных).

    Правило определяет, что делать с пользователем при входе в голосовой канал:
    - **target_list** — применять только к `whitelist` или `blacklist` пользователям
    - **channel_ids** — список каналов, на которые распространяется правило (пусто = все каналы)
    - **max_time_sec** — максимальное время в канале в секундах, после которого выполняется действие
    - **action_type** — действие: `kick` (выкинуть из войса), `mute` (заглушить), `unmute`, `move` (переместить)
    - **action_params** — параметры действия, например `{"target_channel_id": 123}` для `move`
    - **priority** — приоритет правила (больше = выше)
    """
    rows = await rules_repo.get_rules(pool, active_only=False)
    return [RuleResponse(**r) for r in rows]


@router.post("/rules", response_model=RuleResponse)
async def create_rule(
    body: RuleCreate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """
    Создать новое правило.

    Примеры:

    **Кикать всех из блэклиста при входе в канал:**
    ```json
    {
      "name": "Кик блэклиста",
      "is_active": true,
      "target_list": "blacklist",
      "action_type": "kick"
    }
    ```

    **Переместить пользователя в AFK через 1 час:**
    ```json
    {
      "name": "AFK через час",
      "is_active": true,
      "max_time_sec": 3600,
      "action_type": "move",
      "action_params": {"target_channel_id": 123456789}
    }
    ```

    После создания бот применяет правило мгновенно (LISTEN/NOTIFY).
    """
    data = body.model_dump()
    row = await rules_repo.create_rule(pool, data)
    await database.notify_config_changed(pool)
    return RuleResponse(**row)


@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """Получить правило по ID."""
    row = await rules_repo.get_rule_by_id(pool, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    return RuleResponse(**row)


@router.put("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    body: RuleUpdate,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """
    Обновить правило полностью (PUT).

    Передавай только те поля, которые нужно изменить — остальные останутся прежними.
    После обновления бот перезагружает правила мгновенно.
    """
    data = body.model_dump(exclude_unset=True)
    row = await rules_repo.update_rule(pool, rule_id, data)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    await database.notify_config_changed(pool)
    return RuleResponse(**row)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить правило по ID. Связанные расписания удаляются автоматически (CASCADE)."""
    deleted = await rules_repo.delete_rule(pool, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    await database.notify_config_changed(pool)


@router.patch("/rules/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: int,
    _: Annotated[None, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """
    Включить/выключить правило (переключает `is_active`).

    Удобно для быстрого отключения правила без его удаления.
    """
    row = await rules_repo.get_rule_by_id(pool, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    new_active = not row["is_active"]
    updated = await rules_repo.update_rule(pool, rule_id, {"is_active": new_active})
    await database.notify_config_changed(pool)
    return RuleResponse(**updated)
