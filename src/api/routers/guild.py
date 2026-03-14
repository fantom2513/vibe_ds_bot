"""
Роутер guild: информация о сервере Discord.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_bot, get_current_user
from src.config.settings import get_settings

router = APIRouter()


@router.get("/guild/roles")
async def get_guild_roles(
    _: Annotated[None, Depends(get_current_user)],
    bot=Depends(get_bot),
) -> list[dict]:
    """
    Список ролей сервера (без managed и @everyone), отсортированных по позиции.
    Используется для выбора роли при настройке уровней мута.
    """
    settings = get_settings()
    guild = bot.get_guild(settings.DISCORD_GUILD_ID)
    if not guild:
        raise HTTPException(status_code=503, detail="Guild not available")

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "color": str(r.color),
        }
        for r in sorted(guild.roles, key=lambda r: -r.position)
        if not r.managed and r.name != "@everyone"
    ]
