"""
Единая точка входа: бот + FastAPI + планировщик + LISTEN/NOTIFY.
Запуск: python -m src.main
"""
import asyncio

from uvicorn import Config, Server

from src.api.app import app
from src.bot.client import create_bot
from src.config.settings import get_settings, load_config_yaml
from src.db import database
from src.db.repositories import logs_repo, rules_repo, schedules_repo, users_repo
from src.engine import actions, evaluator, tracker
from src.scheduler import jobs as scheduler_jobs
from src.setup_features import reload_stacking, setup_all_features
from src.utils.logging import get_logger, setup_logging


async def main() -> None:
    settings = get_settings()
    config_yaml = load_config_yaml()
    setup_logging(config_yaml=config_yaml)
    logger = get_logger("main")

    logger.info("initializing")
    await database.init_pool()
    pool = database.get_pool()

    app.state.pool = pool

    bot = create_bot(command_prefix=config_yaml.get("bot", {}).get("command_prefix", "!"))
    bot.pool = pool
    bot.tracker = tracker
    bot.rules_repo = rules_repo
    bot.users_repo = users_repo
    bot.logs_repo = logs_repo
    bot.evaluator = evaluator
    bot.actions = actions
    bot.guild_id = settings.DISCORD_GUILD_ID
    bot.config_changed = False

    def get_guild():
        if bot.is_ready():
            return bot.get_guild(settings.DISCORD_GUILD_ID)
        return None

    scheduler = scheduler_jobs.setup_scheduler(
        pool=pool,
        get_guild=get_guild,
        check_interval_sec=settings.SCHEDULER_CHECK_INTERVAL,
    )
    await setup_all_features(bot, pool, scheduler)

    def on_config_changed() -> None:
        bot.config_changed = True
        logger.info("config_changed_notify_received")
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(reload_stacking(bot, pool))
        except RuntimeError:
            pass

    database.register_config_listener(on_config_changed)
    database.start_config_listener()

    await scheduler_jobs.start_scheduler(pool, scheduler)

    server_config = Config(
        app=app,
        host=settings.API_HOST,
        port=settings.API_PORT,
        log_level="info",
    )
    server = Server(server_config)
    server_task = asyncio.create_task(server.serve())
    logger.info("api_started", host=settings.API_HOST, port=settings.API_PORT)

    try:
        await bot.start(settings.DISCORD_TOKEN)
    finally:
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass
        scheduler_jobs.shutdown_scheduler()
        await database.close_pool()
        logger.info("shutdown_complete")


if __name__ == "__main__":
    asyncio.run(main())
