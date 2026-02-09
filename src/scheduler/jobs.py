"""
Планировщик: APScheduler (AsyncIOScheduler).
- check_overtime: периодическая проверка превышения max_time_sec и выполнение действий.
- cron-задачи из schedules: enable/disable правил по расписанию.
"""
from typing import Any, Callable, Optional

import asyncpg
import discord
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from src.db.repositories import logs_repo, rules_repo, schedules_repo
from src.engine import actions as actions_module
from src.engine import tracker
from src.utils.logging import get_logger

logger = get_logger("scheduler.jobs")

# Глобальный экземпляр планировщика (устанавливается в setup_scheduler)
_scheduler: Optional[AsyncIOScheduler] = None


def _get_scheduler() -> AsyncIOScheduler:
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized. Call setup_scheduler first.")
    return _scheduler


async def _check_overtime(
    pool: asyncpg.Pool,
    get_guild: Callable[[], Optional[discord.Guild]],
) -> None:
    """
    Задача check_overtime: загрузить активные правила, получить overtime пользователей,
    для каждого выполнить действие и записать лог.
    """
    guild = get_guild() if get_guild else None
    if not guild:
        logger.debug("check_overtime_skipped_no_guild")
        return

    try:
        rules = await rules_repo.get_all_active_rules(pool)
        if not rules:
            return

        overtime_entries = await tracker.get_overtime_users(pool, rules)
        for entry in overtime_entries:
            discord_id = entry["discord_id"]
            channel_id = entry["channel_id"]
            rule = entry["rule"]
            rule_id = rule.get("id")
            action_type = rule.get("action_type", "")
            action_params = rule.get("action_params") or {}

            member = guild.get_member(discord_id)
            if not member or not member.voice or not member.voice.channel:
                continue
            if member.voice.channel.id != channel_id:
                continue

            ok = await actions_module.execute_action(
                action_type, member, action_params, guild
            )
            await logs_repo.log_action(
                pool,
                rule_id=rule_id,
                discord_id=discord_id,
                action_type=action_type,
                channel_id=channel_id,
                details={"source": "overtime", "overtime_seconds": entry.get("overtime_seconds")},
            )
            if ok:
                logger.info(
                    "overtime_action_executed",
                    discord_id=discord_id,
                    channel_id=channel_id,
                    rule_id=rule_id,
                    action_type=action_type,
                )
    except Exception as e:
        logger.exception("check_overtime_failed", error=str(e))


def _make_schedule_callback(
    pool: asyncpg.Pool,
    schedule_id: int,
    rule_id: int,
    action: str,
) -> Callable[[], Any]:
    """Возвращает корутину для выполнения по расписанию: enable/disable правила."""

    async def _run() -> None:
        try:
            if action == "enable":
                await rules_repo.update_rule(pool, rule_id, {"is_active": True})
                logger.info("schedule_enabled_rule", schedule_id=schedule_id, rule_id=rule_id)
            elif action == "disable":
                await rules_repo.update_rule(pool, rule_id, {"is_active": False})
                logger.info("schedule_disabled_rule", schedule_id=schedule_id, rule_id=rule_id)
        except Exception as e:
            logger.exception(
                "schedule_job_failed",
                schedule_id=schedule_id,
                rule_id=rule_id,
                action=action,
                error=str(e),
            )

    return _run


async def _register_schedule_jobs(
    pool: asyncpg.Pool,
    scheduler: AsyncIOScheduler,
) -> None:
    """
    Загрузить активные расписания и зарегистрировать cron-задачи.
    При срабатывании: enable — включить правило (is_active=True), disable — выключить.
    """
    schedules = await schedules_repo.get_active_schedules(pool)
    for s in schedules:
        schedule_id = s.get("id")
        rule_id = s.get("rule_id")
        cron_expr = s.get("cron_expr")
        action = s.get("action")
        tz = s.get("timezone") or "UTC"

        if not cron_expr or action not in ("enable", "disable"):
            logger.warning(
                "schedule_skipped_invalid",
                schedule_id=schedule_id,
                cron_expr=cron_expr,
                action=action,
            )
            continue

        try:
            trigger = CronTrigger.from_crontab(cron_expr, timezone=tz)
        except Exception as e:
            logger.warning(
                "schedule_skipped_bad_cron",
                schedule_id=schedule_id,
                cron_expr=cron_expr,
                error=str(e),
            )
            continue

        job_id = f"schedule_{schedule_id}"
        callback = _make_schedule_callback(pool, schedule_id, rule_id, action)
        scheduler.add_job(
            callback,
            trigger=trigger,
            id=job_id,
            name=f"schedule_{rule_id}_{action}",
            replace_existing=True,
        )
        logger.info(
            "schedule_registered",
            schedule_id=schedule_id,
            rule_id=rule_id,
            action=action,
            cron_expr=cron_expr,
        )


def setup_scheduler(
    pool: asyncpg.Pool,
    get_guild: Callable[[], Optional[discord.Guild]],
    check_interval_sec: int,
) -> AsyncIOScheduler:
    """
    Создать и настроить AsyncIOScheduler:
    - Интервальная задача check_overtime каждые check_interval_sec секунд.
    - Cron-задачи из schedules (enable/disable правил).

    Не запускает планировщик — вызывающий код должен вызвать scheduler.start().
    """
    global _scheduler
    scheduler = AsyncIOScheduler()
    _scheduler = scheduler

    # check_overtime
    scheduler.add_job(
        _check_overtime,
        trigger=IntervalTrigger(seconds=check_interval_sec),
        args=[pool, get_guild],
        id="check_overtime",
        name="check_overtime",
        replace_existing=True,
    )
    logger.info("scheduler_check_overtime_registered", interval_sec=check_interval_sec)

    # Cron-задачи из schedules (регистрируем асинхронно при старте через start_scheduler)
    # Тут только добавляем задачу, регистрация schedule jobs — в start_scheduler
    return scheduler


async def start_scheduler(
    pool: asyncpg.Pool,
    scheduler: AsyncIOScheduler,
) -> None:
    """
    Зарегистрировать cron-задачи из таблицы schedules и запустить планировщик.
    Вызывать после setup_scheduler, когда event loop уже запущен.
    """
    await _register_schedule_jobs(pool, scheduler)
    scheduler.start()
    logger.info("scheduler_started")


def shutdown_scheduler() -> None:
    """Остановить планировщик."""
    s = _get_scheduler()
    s.shutdown(wait=True)
    logger.info("scheduler_stopped")
