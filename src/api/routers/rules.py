"""
Роутер правил: CRUD и toggle.
"""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import RuleCreate, RuleResponse, RuleUpdate
from src.db import database
from src.db.repositories import rules_repo

router = APIRouter()


@router.get("/rules", response_model=list[RuleResponse])
async def list_rules(
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[RuleResponse]:
    """Список всех правил."""
    rows = await rules_repo.get_rules(pool, active_only=False)
    return [RuleResponse(**r) for r in rows]


@router.post("/rules", response_model=RuleResponse)
async def create_rule(
    body: RuleCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """Создать правило."""
    data = body.model_dump()
    row = await rules_repo.create_rule(pool, data)
    await database.notify_config_changed(pool)
    return RuleResponse(**row)


@router.get("/rules/{rule_id}", response_model=RuleResponse)
async def get_rule(
    rule_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """Получить правило по id."""
    row = await rules_repo.get_rule_by_id(pool, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    return RuleResponse(**row)


@router.put("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    body: RuleUpdate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """Обновить правило."""
    data = body.model_dump(exclude_unset=True)
    row = await rules_repo.update_rule(pool, rule_id, data)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    await database.notify_config_changed(pool)
    return RuleResponse(**row)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить правило."""
    deleted = await rules_repo.delete_rule(pool, rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    await database.notify_config_changed(pool)


@router.patch("/rules/{rule_id}/toggle", response_model=RuleResponse)
async def toggle_rule(
    rule_id: int,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> RuleResponse:
    """Переключить is_active правила."""
    row = await rules_repo.get_rule_by_id(pool, rule_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rule not found")
    new_active = not row["is_active"]
    updated = await rules_repo.update_rule(pool, rule_id, {"is_active": new_active})
    await database.notify_config_changed(pool)
    return RuleResponse(**updated)
