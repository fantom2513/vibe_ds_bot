"""
BotNotifier: отправка embed-сообщений в текстовый лог-канал Discord.
Singleton: set_notifier / get_notifier для доступа из engine/scheduler без передачи зависимости.
"""
from typing import Optional

import discord
from discord.ext import commands

from src.utils.logging import get_logger

log = get_logger("bot.notifier")

_notifier: Optional["BotNotifier"] = None


def set_notifier(n: "BotNotifier") -> None:
    global _notifier
    _notifier = n


def get_notifier() -> Optional["BotNotifier"]:
    return _notifier


class BotNotifier:
    def __init__(
        self,
        bot: commands.Bot,
        log_channel_id: Optional[int],
        log_dry_run_events: bool = True,
        log_pair_moves: bool = True,
        log_kick_timeouts: bool = True,
        log_rule_actions: bool = True,
    ) -> None:
        self._bot = bot
        self._channel_id = log_channel_id
        self._channel: Optional[discord.TextChannel] = None
        self.log_dry_run_events = log_dry_run_events
        self.log_pair_moves = log_pair_moves
        self.log_kick_timeouts = log_kick_timeouts
        self.log_rule_actions = log_rule_actions

    async def setup(self) -> None:
        """Вызывать после on_ready. Кешировать канал."""
        if not self._channel_id:
            return
        self._channel = self._bot.get_channel(self._channel_id)
        if not self._channel:
            log.warning("notifier.channel_not_found", channel_id=self._channel_id)
        else:
            log.info("notifier.channel_ready", channel_id=self._channel_id)

    async def send(self, embed: discord.Embed) -> None:
        if not self._channel:
            return
        try:
            await self._channel.send(embed=embed)
        except discord.HTTPException as e:
            log.warning("notifier.send_failed", error=str(e))
