"""
Cog: голосовые события. on_voice_state_update — tracker, evaluator, actions, логирование.
Pool, tracker, evaluator, actions и репозитории берутся из self.bot.
"""
import asyncio

import discord
from discord.ext import commands

from src.api.sse import broadcaster
from src.engine.rules import rules_from_dicts
from src.scheduler.kick_timeout_job import clear_session_timeout
from src.utils.logging import get_logger

logger = get_logger("voice_manager")


class VoiceManager(commands.Cog):
    """Обработка входов/выходов из голосовых каналов, трекер сессий и движок правил."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self) -> None:
        pool = getattr(self.bot, "pool", None)
        tracker = getattr(self.bot, "tracker", None)
        guild_id = getattr(self.bot, "guild_id", None)
        guild = self.bot.get_guild(guild_id) if guild_id else None
        if guild and pool and tracker:
            await tracker.sync_from_guild(pool, guild)

    @commands.Cog.listener()
    async def on_resumed(self) -> None:
        pool = getattr(self.bot, "pool", None)
        tracker = getattr(self.bot, "tracker", None)
        guild_id = getattr(self.bot, "guild_id", None)
        guild = self.bot.get_guild(guild_id) if guild_id else None
        if guild and pool and tracker:
            await tracker.sync_from_guild(pool, guild)

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        pool = getattr(self.bot, "pool", None)
        tracker = getattr(self.bot, "tracker", None)
        if pool is None or tracker is None:
            logger.warning("voice_event_skipped", reason="pool or tracker not set")
            return

        # Вход или перемещение в канал
        if after.channel is not None:
            if before.channel is not None:
                await tracker.end_session(pool, member.id, before.channel.id)
            await tracker.start_session(pool, member.id, after.channel.id)
            if before.channel is not None:
                logger.info(
                    "voice_move",
                    user_id=member.id,
                    username=member.display_name,
                    from_channel_id=before.channel.id,
                    to_channel_id=after.channel.id,
                )
            else:
                logger.info(
                    "voice_join",
                    user_id=member.id,
                    username=member.display_name,
                    channel_id=after.channel.id,
                )
            asyncio.create_task(broadcaster.broadcast({
                "type": "voice_update",
                "user_id": str(member.id),
                "username": member.display_name,
                "avatar": str(member.display_avatar.url),
                "channel": after.channel.name,
                "action": "move" if before.channel else "join",
            }))

            # Pair stacking: если пара в одном канале — перенос в целевой; при срабатывании правила не выполняем
            stacking = getattr(self.bot, "stacking_detector", None)
            if stacking and member.guild:
                pair_moved = await stacking.check_and_move(member, member.guild)
                if pair_moved:
                    logs_repo = getattr(self.bot, "logs_repo", None)
                    if logs_repo:
                        await logs_repo.log_action(
                            pool,
                            rule_id=None,
                            discord_id=member.id,
                            action_type="pair_move",
                            channel_id=after.channel.id,
                            details={"source": "pair_stacking"},
                        )
                    return

            # Движок правил: активные правила → evaluator → выполнение действий и лог
            rules_repo = getattr(self.bot, "rules_repo", None)
            users_repo = getattr(self.bot, "users_repo", None)
            logs_repo = getattr(self.bot, "logs_repo", None)
            evaluator = getattr(self.bot, "evaluator", None)
            actions = getattr(self.bot, "actions", None)
            if all((rules_repo, users_repo, logs_repo, evaluator, actions)) and member.guild:
                raw_rules = await rules_repo.get_active_rules(pool, after.channel.id)
                rules = rules_from_dicts(raw_rules)
                to_run = await evaluator.evaluate(
                    member, after.channel, rules, users_repo, pool
                )
                for action in to_run:
                    ok = await actions.execute_action(
                        action.action_type,
                        member,
                        action.params,
                        member.guild,
                        is_dry_run=action.is_dry_run,
                        rule_id=action.rule_id,
                        pool=pool,
                    )
                    if ok:
                        try:
                            await logs_repo.log_action(
                                pool,
                                action.rule_id,
                                member.id,
                                action.action_type,
                                after.channel.id,
                                details={"channel_id": after.channel.id},
                            )
                        except Exception as log_err:
                            logger.exception(
                                "voice_action_log_failed",
                                action_type=action.action_type,
                                member_id=member.id,
                                error=str(log_err),
                            )
                        from datetime import datetime
                        asyncio.create_task(broadcaster.broadcast({
                            "type": "action_log",
                            "discord_id": str(member.id),
                            "username": member.display_name,
                            "action_type": action.action_type,
                            "rule_id": action.rule_id,
                            "is_dry_run": action.is_dry_run,
                            "timestamp": datetime.utcnow().isoformat(),
                        }))

            # Обработка мут-состояния (self_mute AND self_deaf)
            mute_xp_service = getattr(self.bot, "mute_xp_service", None)
            if mute_xp_service:
                from src.engine.mute_tracker import mute_tracker
                mute_state_changed = (
                    before.self_mute != after.self_mute
                    or before.self_deaf != after.self_deaf
                )
                if mute_state_changed:
                    if mute_tracker.is_fully_muted(member):
                        mute_tracker.start_mute(member)
                    else:
                        session = mute_tracker.end_mute(member.id)
                        if session:
                            duration = mute_tracker.get_duration(session)
                            asyncio.create_task(
                                mute_xp_service.record_mute_session(pool, member, session, duration)
                            )
                elif before.channel is None and mute_tracker.is_fully_muted(member):
                    # Пользователь зашёл в канал уже замьюченным
                    mute_tracker.start_mute(member)
            return

        # Выход из канала
        if before.channel is not None:
            await tracker.end_session(pool, member.id, before.channel.id)
            stacking = getattr(self.bot, "stacking_detector", None)
            if stacking:
                stacking.on_user_leave(member.id)
            clear_session_timeout(member.id)
            # Завершить мут-сессию при выходе
            mute_xp_service = getattr(self.bot, "mute_xp_service", None)
            if mute_xp_service:
                from src.engine.mute_tracker import mute_tracker
                session = mute_tracker.end_mute(member.id)
                if session:
                    duration = mute_tracker.get_duration(session)
                    asyncio.create_task(
                        mute_xp_service.record_mute_session(pool, member, session, duration)
                    )
            logger.info(
                "voice_leave",
                user_id=member.id,
                username=member.display_name,
                channel_id=before.channel.id,
            )
            asyncio.create_task(broadcaster.broadcast({
                "type": "voice_update",
                "user_id": str(member.id),
                "username": member.display_name,
                "avatar": str(member.display_avatar.url),
                "channel": None,
                "action": "leave",
            }))


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(VoiceManager(bot))
