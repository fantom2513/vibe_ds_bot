"""
Роутер списков пользователей (whitelist/blacklist).
"""
from typing import Annotated, Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.deps import get_db_pool, verify_api_key
from src.api.schemas import UserListBulk, UserListCreate, UserListResponse
from src.db import database
from src.db.repositories import users_repo

router = APIRouter()


@router.get("/users", response_model=list[UserListResponse])
async def list_users(
    list_type: Annotated[Literal["whitelist", "blacklist"], Query(description="Тип списка")],
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[UserListResponse]:
    """Список записей по типу (whitelist или blacklist)."""
    rows = await users_repo.get_user_lists(pool, list_type)
    return [UserListResponse(**r) for r in rows]


@router.post("/users", response_model=UserListResponse)
async def add_user(
    body: UserListCreate,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> UserListResponse:
    """Добавить пользователя в список."""
    row = await users_repo.add_user(
        pool,
        body.discord_id,
        body.list_type,
        username=body.username,
        reason=body.reason,
    )
    await database.notify_config_changed(pool)
    return UserListResponse(**row)


@router.delete("/users/{discord_id}", status_code=204)
async def remove_user(
    discord_id: int,
    list_type: Annotated[Literal["whitelist", "blacklist"], Query()],
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    """Удалить пользователя из списка."""
    deleted = await users_repo.remove_user(pool, discord_id, list_type)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found in list")
    await database.notify_config_changed(pool)


@router.post("/users/bulk")
async def bulk_add_users(
    body: UserListBulk,
    _: Annotated[None, Depends(verify_api_key)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> dict:
    """Массовое добавление в список."""
    entries = [e.model_dump() for e in body.entries]
    count = await users_repo.bulk_add(pool, entries)
    await database.notify_config_changed(pool)
    return {"processed": count}
