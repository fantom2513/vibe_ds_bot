"""
Зависимости FastAPI: пул БД и проверка API-ключа.
"""
from typing import Annotated

import asyncpg
from fastapi import Depends, HTTPException, Request
from fastapi.security import APIKeyHeader

from src.config.settings import get_settings

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_db_pool(request: Request) -> asyncpg.Pool:
    """Возвращает пул БД из состояния приложения (app.state.pool)."""
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise RuntimeError("Пул БД не установлен в app.state.pool")
    return pool


async def verify_api_key(
    api_key: Annotated[str | None, Depends(API_KEY_HEADER)],
) -> None:
    """
    Проверяет заголовок X-API-Key против API_SECRET_KEY.
    При несовпадении или отсутствии ключа — HTTP 401.
    """
    settings = get_settings()
    if not api_key or api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
