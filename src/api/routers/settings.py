"""
Роутер настроек дашборда.
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.deps import get_bot, get_current_user
from src.config.settings import get_settings

router = APIRouter()


class DebugModeUpdate(BaseModel):
    enabled: bool


@router.get("/settings/bot-info")
async def bot_info(
    _: Annotated[dict, Depends(get_current_user)],
    bot=Depends(get_bot),
) -> dict:
    """Информация о боте: имя, guild, uptime, latency."""
    settings = get_settings()
    guild = bot.get_guild(settings.DISCORD_GUILD_ID)
    start_time = getattr(bot, "start_time", None)
    uptime_seconds = int((datetime.utcnow() - start_time).total_seconds()) if start_time else 0
    return {
        "bot_name": bot.user.name if bot.user else "Unknown",
        "guild_id": settings.DISCORD_GUILD_ID,
        "guild_name": guild.name if guild else None,
        "uptime_seconds": uptime_seconds,
        "latency_ms": round(bot.latency * 1000),
    }


@router.get("/settings/debug-mode")
async def get_debug_mode(
    _: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Текущее состояние debug mode."""
    from src.bot.notifier import get_notifier
    notifier = get_notifier()
    return {"debug_mode": notifier.debug_mode if notifier else False}


@router.patch("/settings/debug-mode")
async def toggle_debug_mode(
    body: DebugModeUpdate,
    _: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Включить/выключить debug mode без перезапуска бота."""
    from src.bot.notifier import get_notifier
    notifier = get_notifier()
    if notifier is None:
        return {"debug_mode": False}
    notifier.debug_mode = body.enabled
    return {"debug_mode": notifier.debug_mode}


@router.get("/settings/allowed-users")
async def allowed_users(
    _: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Список Discord ID с доступом к дашборду (из .env)."""
    settings = get_settings()
    return {
        "allowed_discord_ids": settings.ALLOWED_DISCORD_IDS,
        "note": "Изменение требует перезапуска",
    }
