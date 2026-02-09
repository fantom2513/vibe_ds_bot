"""
Cog: голосовые события. on_voice_state_update — tracker, evaluator, actions, логирование.
Pool, tracker, evaluator, actions и репозитории берутся из self.bot.
"""
import discord
from discord.ext import commands

from src.engine.rules import rules_from_dicts
from src.utils.logging import get_logger

logger = get_logger("voice_manager")


class VoiceManager(commands.Cog):
    """Обработка входов/выходов из голосовых каналов, трекер сессий и движок правил."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

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
                        action.action_type, member, action.params, member.guild
                    )
                    if ok:
                        await logs_repo.log_action(
                            pool,
                            action.rule_id,
                            member.id,
                            action.action_type,
                            after.channel.id,
                            details={"channel_id": after.channel.id},
                        )
            return

        # Выход из канала
        if before.channel is not None:
            await tracker.end_session(pool, member.id, before.channel.id)
            stacking = getattr(self.bot, "stacking_detector", None)
            if stacking:
                stacking.on_user_leave(member.id)
            logger.info(
                "voice_leave",
                user_id=member.id,
                username=member.display_name,
                channel_id=before.channel.id,
            )


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(VoiceManager(bot))
