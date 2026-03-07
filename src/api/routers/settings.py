"""
Роутер настроек дашборда.
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from src.api.deps import get_bot, get_current_user
from src.config.settings import get_settings

router = APIRouter()


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
