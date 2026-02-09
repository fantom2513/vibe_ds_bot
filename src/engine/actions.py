"""
Модуль действий: mute, unmute, move, kick. Проверка прав и защита владельца гильдии.
Rate limiting: N действий в минуту на гильдию (из настроек).
"""
from typing import Any, Optional

import discord

from src.config.settings import get_settings
from src.utils.logging import get_logger
from src.utils.permissions import can_kick, can_mute, can_move
from src.utils.rate_limit import check_action_allowed, record_action

logger = get_logger("engine.actions")


async def execute_action(
    action_type: str,
    member: discord.Member,
    params: dict[str, Any],
    guild: discord.Guild,
) -> bool:
    """
    Выполнить действие над участником. Возвращает True при успехе, False при ошибке или отказе.
    Владельца гильдии не трогаем. Учитывается rate limit на гильдию.
    """
    if member.id == guild.owner_id:
        logger.warning("action_skipped_owner", member_id=member.id, action_type=action_type)
        return False

    max_per_minute = get_settings().RATE_LIMIT_ACTIONS_PER_MINUTE
    if not check_action_allowed(guild.id, max_per_minute):
        logger.warning(
            "action_skipped_rate_limit",
            guild_id=guild.id,
            action_type=action_type,
            max_per_minute=max_per_minute,
        )
        return False

    try:
        if action_type == "mute":
            if not can_mute(member, guild):
                logger.warning("action_skipped_no_permission", action_type="mute", member_id=member.id)
                return False
            await member.edit(mute=True)
            record_action(guild.id)
            return True

        if action_type == "unmute":
            if not can_mute(member, guild):
                logger.warning("action_skipped_no_permission", action_type="unmute", member_id=member.id)
                return False
            await member.edit(mute=False)
            record_action(guild.id)
            return True

        if action_type == "move":
            if not can_move(member, guild):
                logger.warning("action_skipped_no_permission", action_type="move", member_id=member.id)
                return False
            target_channel_id = params.get("target_channel_id")
            if target_channel_id is None:
                logger.warning("action_skipped_missing_param", action_type="move", param="target_channel_id")
                return False
            channel = guild.get_channel(int(target_channel_id))
            if channel is None or not isinstance(channel, discord.VoiceChannel):
                logger.warning("action_skipped_channel_not_found", target_channel_id=target_channel_id)
                return False
            await member.move_to(channel)
            record_action(guild.id)
            return True

        if action_type == "kick":
            if not can_kick(member, guild):
                logger.warning("action_skipped_no_permission", action_type="kick", member_id=member.id)
                return False
            await member.move_to(None)
            record_action(guild.id)
            return True

        logger.warning("action_unknown", action_type=action_type)
        return False
    except discord.HTTPException as e:
        logger.exception("action_failed", action_type=action_type, member_id=member.id, status=e.status)
        return False
    except Exception as e:
        logger.exception("action_error", action_type=action_type, member_id=member.id, error=str(e))
        return False
