"""
Модуль действий: mute, unmute, move, kick. Проверка прав и защита владельца гильдии.
Rate limiting: N действий в минуту на гильдию (из настроек).
Dry run: если is_dry_run=True — действие логируется, но не выполняется.
"""
from typing import Any, Optional

import asyncpg
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
    is_dry_run: bool = False,
    rule_id: Optional[int] = None,
    pool: Optional[asyncpg.Pool] = None,
) -> bool:
    """
    Выполнить действие над участником. Возвращает True при успехе, False при ошибке или отказе.
    Владельца гильдии не трогаем. Учитывается rate limit на гильдию.
    Если is_dry_run=True — действие не выполняется, только логируется.
    """
    if is_dry_run:
        voice_channel = member.voice.channel if member.voice and member.voice.channel else None
        logger.info(
            "action.dry_run",
            rule_id=rule_id,
            discord_id=str(member.id),
            action_type=action_type,
            action_params=params,
            channel=str(voice_channel.id) if voice_channel else None,
        )
        if pool is not None and rule_id is not None:
            from src.db.repositories import logs_repo
            await logs_repo.log_action(
                pool,
                rule_id=rule_id,
                discord_id=member.id,
                action_type=action_type,
                channel_id=voice_channel.id if voice_channel else None,
                details={**params, "dry_run": True},
            )
        from src.bot.notifier import get_notifier
        from src.bot.embeds import build_rule_action_embed
        notifier = get_notifier()
        if notifier and notifier.log_dry_run_events:
            await notifier.send(build_rule_action_embed(
                member, action_type, voice_channel, rule_id, is_dry_run=True
            ))
        return False  # сигнал вызывающему коду что реальное действие не выполнено

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
        voice_channel = member.voice.channel if member.voice and member.voice.channel else None

        if action_type == "mute":
            if not can_mute(member, guild):
                logger.warning("action_skipped_no_permission", action_type="mute", member_id=member.id)
                return False
            await member.edit(mute=True)
            record_action(guild.id)
            await _notify_rule_action(member, action_type, voice_channel, rule_id)
            return True

        if action_type == "unmute":
            if not can_mute(member, guild):
                logger.warning("action_skipped_no_permission", action_type="unmute", member_id=member.id)
                return False
            await member.edit(mute=False)
            record_action(guild.id)
            await _notify_rule_action(member, action_type, voice_channel, rule_id)
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
            await _notify_rule_action(member, action_type, voice_channel, rule_id)
            return True

        if action_type == "kick":
            if not can_kick(member, guild):
                logger.warning("action_skipped_no_permission", action_type="kick", member_id=member.id)
                return False
            await member.move_to(None)
            record_action(guild.id)
            await _notify_rule_action(member, action_type, voice_channel, rule_id)
            return True

        logger.warning("action_unknown", action_type=action_type)
        return False
    except discord.HTTPException as e:
        logger.exception("action_failed", action_type=action_type, member_id=member.id, status=e.status)
        return False
    except Exception as e:
        logger.exception("action_error", action_type=action_type, member_id=member.id, error=str(e))
        return False


async def _notify_rule_action(
    member: discord.Member,
    action_type: str,
    channel: Optional[discord.VoiceChannel],
    rule_id: Optional[int],
) -> None:
    from src.bot.notifier import get_notifier
    from src.bot.embeds import build_rule_action_embed
    notifier = get_notifier()
    if notifier and notifier.log_rule_actions:
        await notifier.send(build_rule_action_embed(member, action_type, channel, rule_id))
