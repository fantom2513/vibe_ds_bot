"""
Проверка таймаутов в войсе: пользователи из kick_targets, сидящие дольше timeout_sec — тихий disconnect.
Если задан max_timeout_sec, таймаут рандомизируется в диапазоне [timeout_sec, max_timeout_sec] для каждой сессии.
"""
import random
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import asyncpg

from src.engine import tracker
from src.utils.logging import get_logger

if TYPE_CHECKING:
    from discord.ext import commands

logger = get_logger("scheduler.kick_timeout")

# discord_id -> эффективный таймаут для текущей сессии (сбрасывается при выходе из канала)
_session_timeouts: dict[int, int] = {}


def clear_session_timeout(discord_id: int) -> None:
    """Сбросить таймаут сессии при выходе пользователя из канала."""
    _session_timeouts.pop(discord_id, None)


async def load_kick_targets(pool: asyncpg.Pool) -> dict[int, dict]:
    """
    Загрузить активные таргеты: discord_id -> {timeout_sec, max_timeout_sec}.
    """
    rows = await pool.fetch(
        "SELECT discord_id, timeout_sec, max_timeout_sec FROM kick_targets WHERE is_active = true"
    )
    return {
        r["discord_id"]: {
            "timeout_sec": r["timeout_sec"],
            "max_timeout_sec": r["max_timeout_sec"],
        }
        for r in rows
    }


def _get_effective_timeout(discord_id: int, target: dict) -> int:
    """
    Вернуть эффективный таймаут для сессии.
    Если max_timeout_sec задан — генерируем рандомный таймаут один раз на сессию.
    """
    if discord_id in _session_timeouts:
        return _session_timeouts[discord_id]

    min_sec = target["timeout_sec"]
    max_sec = target["max_timeout_sec"]

    if max_sec and max_sec > min_sec:
        effective = random.randint(min_sec, max_sec)
    else:
        effective = min_sec

    _session_timeouts[discord_id] = effective
    logger.info(
        "kick_timeout_session_assigned",
        discord_id=discord_id,
        timeout_sec=effective,
        is_random=bool(max_sec and max_sec > min_sec),
    )
    return effective


def _elapsed_seconds(joined_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    j = joined_at if joined_at.tzinfo else joined_at.replace(tzinfo=timezone.utc)
    return (now - j).total_seconds()


async def check_kick_timeouts(bot: "commands.Bot") -> None:
    """
    1. Получить pool и guild из bot
    2. load_kick_targets(pool)
    3. tracker.get_current_sessions() → (discord_id, channel_id, joined_at)
    4. Для каждой сессии: если discord_id в targets и elapsed >= effective_timeout:
       — guild.get_member(discord_id), member.move_to(None), INSERT в action_logs
    """
    pool = getattr(bot, "pool", None)
    guild_id = getattr(bot, "guild_id", None)
    if pool is None or guild_id is None:
        return
    guild = bot.get_guild(guild_id) if bot.is_ready() else None
    if not guild:
        logger.debug("kick_timeout_skipped_no_guild")
        return

    logs_repo = getattr(bot, "logs_repo", None)
    if not logs_repo:
        logger.warning("kick_timeout_skipped_no_logs_repo")
        return

    try:
        targets = await load_kick_targets(pool)
        if not targets:
            return

        sessions = tracker.get_current_sessions()
        for discord_id, channel_id, joined_at in sessions:
            target = targets.get(discord_id)
            if target is None:
                continue

            effective_timeout = _get_effective_timeout(discord_id, target)
            if _elapsed_seconds(joined_at) < effective_timeout:
                continue

            member = guild.get_member(discord_id)
            if not member or not member.voice or not member.voice.channel or member.voice.channel.id != channel_id:
                continue

            voice_channel = member.voice.channel
            elapsed = _elapsed_seconds(joined_at)

            try:
                await member.move_to(None, reason="kick timeout")
            except Exception as e:
                logger.warning(
                    "kick_timeout_move_failed",
                    discord_id=discord_id,
                    error=str(e),
                )
                continue

            clear_session_timeout(discord_id)
            try:
                await logs_repo.log_action(
                    pool,
                    rule_id=None,
                    discord_id=discord_id,
                    action_type="kick_timeout",
                    channel_id=channel_id,
                    details={"timeout_sec": effective_timeout},
                )
            except Exception as log_err:
                logger.exception(
                    "kick_timeout_log_failed",
                    discord_id=discord_id,
                    error=str(log_err),
                )
            logger.info(
                "kick_timeout_executed",
                discord_id=discord_id,
                channel_id=channel_id,
                timeout_sec=effective_timeout,
            )
            try:
                from src.bot.notifier import get_notifier
                from src.bot.embeds import build_kick_timeout_embed
                notifier = get_notifier()
                if notifier and notifier.log_kick_timeouts:
                    await notifier.send(
                        build_kick_timeout_embed(member, voice_channel, elapsed)
                    )
            except Exception as e:
                logger.warning("kick_timeout_notify_failed", error=str(e))
    except Exception as e:
        logger.exception("check_kick_timeouts_failed", error=str(e))
