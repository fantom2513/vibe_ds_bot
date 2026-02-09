"""
Точка входа для запуска только бота (без FastAPI и scheduler).
Загружает конфиг, инициализирует логгер, создаёт пул БД и трекер, присваивает их боту, запускает client.
"""
import asyncio

from src.bot.client import create_bot
from src.config.settings import get_settings, load_config_yaml
from src.db import database
from src.db.repositories import logs_repo, rules_repo, users_repo
from src.engine import actions, evaluator, tracker
from src.utils.logging import get_logger, setup_logging


async def main() -> None:
    settings = get_settings()
    config_yaml = load_config_yaml()
    setup_logging(config_yaml=config_yaml)

    logger = get_logger("run_bot")
    logger.info("starting_bot")

    await database.init_pool()
    pool = database.get_pool()

    bot = create_bot(command_prefix=config_yaml.get("bot", {}).get("command_prefix", "!"))
    bot.pool = pool
    bot.tracker = tracker
    bot.rules_repo = rules_repo
    bot.users_repo = users_repo
    bot.logs_repo = logs_repo
    bot.evaluator = evaluator
    bot.actions = actions
    bot.guild_id = settings.DISCORD_GUILD_ID

    try:
        await bot.start(settings.DISCORD_TOKEN)
    finally:
        await database.close_pool()
        logger.info("pool_closed")


if __name__ == "__main__":
    asyncio.run(main())
