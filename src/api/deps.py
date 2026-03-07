"""
Зависимости FastAPI: пул БД, аутентификация, scheduler, бот.
"""
from typing import Annotated, Optional

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from src.config.settings import get_settings

_scheduler: Optional[AsyncIOScheduler] = None


def set_scheduler(s: AsyncIOScheduler) -> None:
    global _scheduler
    _scheduler = s


def get_scheduler() -> AsyncIOScheduler:
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized")
    return _scheduler


async def get_db_pool(request: Request) -> asyncpg.Pool:
    """Возвращает пул БД из состояния приложения (app.state.pool)."""
    pool = getattr(request.app.state, "pool", None)
    if pool is None:
        raise RuntimeError("Пул БД не установлен в app.state.pool")
    return pool


async def get_current_user(request: Request) -> dict:
    """
    Читает JWT из httpOnly cookie access_token.
    При отсутствии или невалидном токене — HTTP 401.
    """
    settings = get_settings()
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Cookie"},
        )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return {
            "sub": payload["sub"],
            "username": payload["username"],
            "avatar": payload.get("avatar"),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_bot(request: Request):
    """Возвращает экземпляр бота из app.state.bot."""
    bot = getattr(request.app.state, "bot", None)
    if bot is None:
        raise HTTPException(status_code=503, detail="Bot not available")
    return bot
