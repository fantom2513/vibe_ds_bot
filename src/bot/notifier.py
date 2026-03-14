"""
BotNotifier: отправка embed-сообщений в Discord-каналы.
- send()       — основные события (level up, pair move, kick timeout)
- send_debug() — real-time события (только если debug_mode=True)
- send_daily() — ежедневная статистика

Singleton: set_notifier / get_notifier для доступа без передачи зависимости.
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
        debug_channel_id: Optional[int] = None,
        daily_stats_channel_id: Optional[int] = None,
        debug_mode: bool = False,
        log_dry_run_events: bool = True,
        log_pair_moves: bool = True,
        log_kick_timeouts: bool = True,
        log_rule_actions: bool = True,
    ) -> None:
        self._bot = bot
        self._channel_id = log_channel_id
        self._debug_channel_id = debug_channel_id
        self._daily_channel_id = daily_stats_channel_id
        self._channel: Optional[discord.TextChannel] = None
        self._debug_channel: Optional[discord.TextChannel] = None
        self._daily_channel: Optional[discord.TextChannel] = None
        self.debug_mode = debug_mode
        self.log_dry_run_events = log_dry_run_events
        self.log_pair_moves = log_pair_moves
        self.log_kick_timeouts = log_kick_timeouts
        self.log_rule_actions = log_rule_actions

    async def setup(self) -> None:
        """Вызывать после on_ready — кешировать каналы."""
        if self._channel_id:
            self._channel = self._bot.get_channel(self._channel_id)
            if not self._channel:
                log.warning("notifier.channel_not_found", channel_id=self._channel_id)
            else:
                log.info("notifier.channel_ready", channel_id=self._channel_id)

        if self._debug_channel_id:
            self._debug_channel = self._bot.get_channel(self._debug_channel_id)
            if not self._debug_channel:
                log.warning("notifier.debug_channel_not_found", channel_id=self._debug_channel_id)
            else:
                log.info("notifier.debug_channel_ready", channel_id=self._debug_channel_id)

        if self._daily_channel_id:
            self._daily_channel = self._bot.get_channel(self._daily_channel_id)
            if not self._daily_channel:
                log.warning("notifier.daily_channel_not_found", channel_id=self._daily_channel_id)
            else:
                log.info("notifier.daily_channel_ready", channel_id=self._daily_channel_id)

    async def send(self, embed: discord.Embed) -> None:
        """Основные события — level up, pair move, kick timeout и т.д."""
        await self._safe_send(self._channel, embed)

    async def send_debug(self, embed: discord.Embed) -> None:
        """Real-time события — только если debug_mode включён."""
        if not self.debug_mode or not self._debug_channel:
            return
        await self._safe_send(self._debug_channel, embed)

    async def send_daily(self, embed: discord.Embed) -> None:
        """Ежедневная статистика."""
        await self._safe_send(self._daily_channel, embed)

    async def _safe_send(self, channel: Optional[discord.TextChannel], embed: discord.Embed) -> None:
        if not channel:
            return
        try:
            await channel.send(embed=embed)
        except discord.HTTPException as e:
            log.warning(
                "notifier.send_failed",
                channel_id=str(channel.id),
                error=str(e),
            )
