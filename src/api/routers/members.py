"""
Роутер members: резолвинг участников сервера через guild.members кэш discord.py.
Не делает HTTP запросов к Discord API — работает только с кэшем бота.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.api.deps import get_bot, get_current_user

router = APIRouter(prefix="/members", tags=["members"])


def _member_to_dict(member) -> dict:
    """Сериализовать участника Discord в dict для API ответа."""
    return {
        "id": str(member.id),
        "display_name": member.display_name,
        "username": member.name,
        "avatar": str(member.display_avatar.url) if member.display_avatar else None,
        "label": f"{member.display_name} (@{member.name})",
    }


def _unknown_dict(member_id: str) -> dict:
    """Заглушка для участника которого нет на сервере."""
    return {
        "id": member_id,
        "display_name": "Unknown",
        "username": member_id,
        "avatar": None,
        "label": f"Unknown (@{member_id})",
    }


def _get_guild(bot):
    """Получить guild из кэша бота. 503 если бот не готов."""
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="Bot is not ready")
    from src.config.settings import get_settings
    guild = bot.get_guild(get_settings().DISCORD_GUILD_ID)
    if not guild:
        raise HTTPException(status_code=503, detail="Guild not found in cache")
    return guild


@router.get("")
async def list_members(
    _: Annotated[None, Depends(get_current_user)],
    bot=Depends(get_bot),
    q: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """
    Список участников сервера из кэша discord.py.
    Опциональный поиск по серверному нику или username.
    Боты исключаются.
    """
    guild = _get_guild(bot)

    members = [m for m in guild.members if not m.bot]

    if q and q.strip():
        q_lower = q.strip().lower()
        members = [
            m for m in members
            if q_lower in m.display_name.lower() or q_lower in m.name.lower()
        ]

    # Участники с серверным ником идут первыми, затем по алфавиту
    members.sort(key=lambda m: (m.display_name == m.name, m.display_name.lower()))

    return [_member_to_dict(m) for m in members[:limit]]


@router.post("/batch")
async def get_members_batch(
    ids: list[str],
    _: Annotated[None, Depends(get_current_user)],
    bot=Depends(get_bot),
) -> dict[str, dict]:
    """
    Batch-резолвинг Discord ID → данные участника.
    Для ID которых нет на сервере возвращает заглушку Unknown.
    """
    guild = _get_guild(bot)

    result: dict[str, dict] = {}
    for id_str in ids:
        try:
            member = guild.get_member(int(id_str))
            result[id_str] = _member_to_dict(member) if member else _unknown_dict(id_str)
        except (ValueError, AttributeError):
            result[id_str] = _unknown_dict(id_str)

    return result


@router.get("/{member_id}")
async def get_member(
    member_id: int,
    _: Annotated[None, Depends(get_current_user)],
    bot=Depends(get_bot),
) -> dict:
    """
    Получить одного участника по Discord ID.
    Если участник ушёл с сервера — возвращает заглушку, не 404.
    """
    guild = _get_guild(bot)
    member = guild.get_member(member_id)
    if not member:
        return _unknown_dict(str(member_id))
    return _member_to_dict(member)
