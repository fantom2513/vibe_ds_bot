"""
Инициализация Pair Stacking и Kick Timeout при старте бота.
"""
from typing import Optional

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from src.config.settings import get_settings, get_stacking_pairs, load_config_yaml
from src.engine.stacking import PairRule, StackingDetector
from src.scheduler import kick_timeout_job
from src.utils.logging import get_logger

logger = get_logger("setup_features")


async def setup_stacking(bot, pool: asyncpg.Pool) -> StackingDetector:
    """
    1. Загрузить пары из config.yaml (get_stacking_pairs)
    2. Загрузить пары из БД (SELECT FROM stacking_pairs WHERE is_active)
    3. Дедупликация: ключ = frozenset(uid1, uid2), БД приоритетнее
    4. detector.load_pairs(all_pairs)
    5. bot.stacking_detector = detector
    """
    config = load_config_yaml()
    yaml_pairs = get_stacking_pairs(config)
    yaml_rules = [
        PairRule(p["user_id_1"], p["user_id_2"], p["target_channel_id"])
        for p in yaml_pairs
    ]

    db_pairs: list[tuple[int, int, int]] = []
    try:
        rows = await pool.fetch(
            "SELECT user_id_1, user_id_2, target_channel_id FROM stacking_pairs WHERE is_active = true"
        )
        db_pairs = [(r["user_id_1"], r["user_id_2"], r["target_channel_id"]) for r in rows]
    except Exception as e:
        logger.warning("stacking_load_db_failed", error=str(e))

    by_key: dict[frozenset[int], PairRule] = {}
    for r in yaml_rules:
        by_key[r.pair_key()] = r
    for uid1, uid2, target_id in db_pairs:
        by_key[frozenset((uid1, uid2))] = PairRule(uid1, uid2, target_id)

    detector = StackingDetector()
    detector.load_pairs(list(by_key.values()))
    bot.stacking_detector = detector
    logger.info("stacking_initialized", pairs_count=len(by_key))
    return detector


async def reload_stacking(bot, pool: asyncpg.Pool) -> None:
    """
    Перезагрузить пары стакинга из config.yaml и БД (для вызова по NOTIFY config_changed).
    Обновляет список пар у существующего bot.stacking_detector, сохраняя _recently_moved.
    """
    detector = getattr(bot, "stacking_detector", None)
    if detector is None:
        return
    config = load_config_yaml()
    yaml_pairs = get_stacking_pairs(config)
    yaml_rules = [
        PairRule(p["user_id_1"], p["user_id_2"], p["target_channel_id"])
        for p in yaml_pairs
    ]
    db_pairs: list[tuple[int, int, int]] = []
    try:
        rows = await pool.fetch(
            "SELECT user_id_1, user_id_2, target_channel_id FROM stacking_pairs WHERE is_active = true"
        )
        db_pairs = [(r["user_id_1"], r["user_id_2"], r["target_channel_id"]) for r in rows]
    except Exception as e:
        logger.warning("stacking_reload_db_failed", error=str(e))
    by_key: dict[frozenset[int], PairRule] = {}
    for r in yaml_rules:
        by_key[r.pair_key()] = r
    for uid1, uid2, target_id in db_pairs:
        by_key[frozenset((uid1, uid2))] = PairRule(uid1, uid2, target_id)
    detector.load_pairs(list(by_key.values()))
    logger.info("stacking_reloaded", pairs_count=len(by_key))


def setup_kick_timeout_scheduler(
    bot,
    scheduler: Optional[AsyncIOScheduler] = None,
) -> Optional[AsyncIOScheduler]:
    """
    Добавить interval job: check_kick_timeouts каждые SCHEDULER_CHECK_INTERVAL сек.
    """
    if scheduler is None:
        return None
    settings = get_settings()
    interval_sec = settings.SCHEDULER_CHECK_INTERVAL
    scheduler.add_job(
        kick_timeout_job.check_kick_timeouts,
        trigger=IntervalTrigger(seconds=interval_sec),
        args=[bot],
        id="check_kick_timeouts",
        name="check_kick_timeouts",
        replace_existing=True,
    )
    logger.info("kick_timeout_scheduler_registered", interval_sec=interval_sec)
    return scheduler


async def setup_all_features(
    bot,
    pool: asyncpg.Pool,
    scheduler: Optional[AsyncIOScheduler] = None,
) -> Optional[AsyncIOScheduler]:
    """
    Вызвать setup_stacking + setup_kick_timeout_scheduler.
    Установить bot.guild_id = settings.DISCORD_GUILD_ID.
    """
    settings = get_settings()
    bot.guild_id = settings.DISCORD_GUILD_ID
    await setup_stacking(bot, pool)
    setup_kick_timeout_scheduler(bot, scheduler)
    return scheduler
