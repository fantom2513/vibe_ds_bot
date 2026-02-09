"""
Discord-бот: intents, загрузка cogs (voice_manager, admin_commands), on_ready.
Пул БД и трекер передаются через атрибуты (bot.pool, bot.tracker) до запуска.
"""
from typing import Any, Optional

import discord
from discord.ext import commands

# Типы для атрибутов, которые задаются при старте приложения
import asyncpg


class VoiceBot(commands.Bot):
    """
    Бот с поддержкой голосовых событий и slash-команд.
    Перед run() необходимо установить: bot.pool, bot.tracker.
    """

    pool: Optional[asyncpg.Pool] = None
    tracker: Optional[Any] = None  # модуль/объект с start_session, end_session
    guild_id: Optional[int] = None  # для синхронизации slash-команд с гильдией
    config_changed: bool = False  # флаг после NOTIFY config_changed (перечитание правил при следующем событии)

    def __init__(self, command_prefix: str = "!", **kwargs: Any) -> None:
        intents = discord.Intents.default()
        intents.guilds = True
        intents.voice_states = True
        intents.members = True  # GUILD_MEMBERS — privileged
        super().__init__(command_prefix=command_prefix, intents=intents, **kwargs)

    async def setup_hook(self) -> None:
        """Загрузка cogs при старте."""
        await self.load_extension("src.bot.cogs.voice_manager")
        await self.load_extension("src.bot.cogs.admin_commands")

    async def on_ready(self) -> None:
        """Логирование имени бота и количества гильдий; синхронизация slash-команд с гильдией."""
        logger = __import__("structlog", fromlist=["get_logger"]).get_logger("bot")
        logger.info(
            "bot_ready",
            user=str(self.user),
            guild_count=len(self.guilds),
        )
        guild_id = getattr(self, "guild_id", None)
        if guild_id is not None:
            self.tree.copy_global_to(guild=discord.Object(id=guild_id))
            await self.tree.sync(guild=discord.Object(id=guild_id))
            logger.info("slash_commands_synced", guild_id=guild_id)
        else:
            await self.tree.sync()
            logger.info("slash_commands_synced_global")


def create_bot(command_prefix: str = "!") -> VoiceBot:
    """Фабрика: создаёт экземпляр бота (pool и tracker задаются вызывающим кодом)."""
    return VoiceBot(command_prefix=command_prefix)
