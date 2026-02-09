"""
Проверка таймаутов в войсе: пользователи из kick_targets, сидящие дольше timeout_sec — тихий disconnect.
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING

import asyncpg

from src.engine import tracker
from src.utils.logging import get_logger

if TYPE_CHECKING:
    from discord.ext import commands

logger = get_logger("scheduler.kick_timeout")


async def load_kick_targets(pool: asyncpg.Pool) -> dict[int, int]:
    """
    Загрузить активные таргеты: discord_id -> timeout_sec.
    """
    rows = await pool.fetch(
        "SELECT discord_id, timeout_sec FROM kick_targets WHERE is_active = true"
    )
    return {r["discord_id"]: r["timeout_sec"] for r in rows}


def _elapsed_seconds(joined_at: datetime) -> float:
    now = datetime.now(timezone.utc)
    j = joined_at if joined_at.tzinfo else joined_at.replace(tzinfo=timezone.utc)
    return (now - j).total_seconds()


async def check_kick_timeouts(bot: "commands.Bot") -> None:
    """
    1. Получить pool и guild из bot
    2. load_kick_targets(pool)
    3. tracker.get_current_sessions() → (discord_id, channel_id, joined_at)
    4. Для каждой сессии: если discord_id в targets и elapsed >= timeout:
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
            timeout_sec = targets.get(discord_id)
            if timeout_sec is None:
                continue
            if _elapsed_seconds(joined_at) < timeout_sec:
                continue

            member = guild.get_member(discord_id)
            if not member or not member.voice or not member.voice.channel or member.voice.channel.id != channel_id:
                continue

            try:
                await member.move_to(None, reason="kick timeout")
            except Exception as e:
                logger.warning(
                    "kick_timeout_move_failed",
                    discord_id=discord_id,
                    error=str(e),
                )
                continue

            await logs_repo.log_action(
                pool,
                rule_id=None,
                discord_id=discord_id,
                action_type="kick_timeout",
                channel_id=channel_id,
                details={"timeout_sec": timeout_sec},
            )
            logger.info(
                "kick_timeout_executed",
                discord_id=discord_id,
                channel_id=channel_id,
                timeout_sec=timeout_sec,
            )
    except Exception as e:
        logger.exception("check_kick_timeouts_failed", error=str(e))
