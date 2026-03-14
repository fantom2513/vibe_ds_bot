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

from src.db.repositories import logs_repo, rules_repo, schedules_repo, stats_repo
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

            is_dry_run = rule.get("is_dry_run", False)
            ok = await actions_module.execute_action(
                action_type,
                member,
                action_params,
                guild,
                is_dry_run=is_dry_run,
                rule_id=rule_id,
                pool=pool,
            )
            if ok:
                await logs_repo.log_action(
                    pool,
                    rule_id=rule_id,
                    discord_id=discord_id,
                    action_type=action_type,
                    channel_id=channel_id,
                    details={"source": "overtime", "overtime_seconds": entry.get("overtime_seconds")},
                )
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


def register_schedule_job(
    scheduler: AsyncIOScheduler,
    schedule: dict,
    pool: asyncpg.Pool,
) -> Optional[str]:
    """
    Зарегистрировать CronTrigger job для расписания.
    schedule — dict с ключами: id, rule_id, cron_expr, action, timezone.
    Возвращает job_id при успехе, None при ошибке.
    """
    schedule_id = schedule.get("id")
    rule_id = schedule.get("rule_id")
    cron_expr = schedule.get("cron_expr")
    action = schedule.get("action")
    tz = schedule.get("timezone") or "UTC"

    if not cron_expr or action not in ("enable", "disable"):
        logger.warning(
            "schedule_skipped_invalid",
            schedule_id=schedule_id,
            cron_expr=cron_expr,
            action=action,
        )
        return None

    try:
        trigger = CronTrigger.from_crontab(cron_expr, timezone=tz)
    except Exception as e:
        logger.warning(
            "schedule_skipped_bad_cron",
            schedule_id=schedule_id,
            cron_expr=cron_expr,
            error=str(e),
        )
        return None

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
    return job_id


async def _register_schedule_jobs(
    pool: asyncpg.Pool,
    scheduler: AsyncIOScheduler,
) -> None:
    """
    Загрузить активные расписания из БД и зарегистрировать cron-задачи.
    При срабатывании: enable — включить правило (is_active=True), disable — выключить.
    """
    schedules = await schedules_repo.get_active_schedules(pool)
    for s in schedules:
        register_schedule_job(scheduler, s, pool)


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


async def tick_mute_xp(pool: asyncpg.Pool, mute_tracker, mute_xp_service, bot) -> None:
    """Каждую минуту начислять XP пользователям, которые прямо сейчас в полном муте."""
    from src.engine.mute_xp_service import MUTE_XP_PER_MINUTE
    active = mute_tracker.get_active()
    if not active:
        return

    guild_id = getattr(bot, "guild_id", None)
    guild = bot.get_guild(guild_id) if guild_id else None
    if not guild:
        return

    for member_id in list(active.keys()):
        member = guild.get_member(member_id)
        if not member:
            continue
        try:
            await mute_xp_service._add_xp(pool, member, MUTE_XP_PER_MINUTE)
        except Exception as e:
            logger.warning("mute_xp.tick_failed", discord_id=str(member_id), error=str(e))

    logger.info("mute_xp.tick", active_sessions=len(active))


async def send_daily_stats(pool: asyncpg.Pool, notifier, bot) -> None:
    """Отправить статистику за прошедшие 24 часа в daily-канал."""
    from datetime import datetime, timezone

    try:
        stats = await pool.fetchrow("""
            SELECT
                COUNT(DISTINCT vs.discord_id) AS unique_users,
                COUNT(*) AS total_sessions,
                COALESCE(SUM(
                    EXTRACT(EPOCH FROM (
                        COALESCE(vs.left_at, NOW()) - vs.joined_at
                    ))
                ), 0)::INT AS total_voice_seconds,
                (SELECT COUNT(*) FROM action_logs
                 WHERE created_at >= NOW() - INTERVAL '24 hours') AS total_actions
            FROM voice_sessions vs
            WHERE vs.joined_at >= NOW() - INTERVAL '24 hours'
        """)

        top_mute = await pool.fetchrow("""
            SELECT discord_id, SUM(duration_sec) AS total_sec
            FROM mute_sessions
            WHERE started_at >= NOW() - INTERVAL '24 hours'
              AND ended_at IS NOT NULL
            GROUP BY discord_id
            ORDER BY total_sec DESC
            LIMIT 1
        """)

        action_breakdown = await pool.fetch("""
            SELECT action_type, COUNT(*) AS cnt
            FROM action_logs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY action_type
            ORDER BY cnt DESC
        """)
    except Exception as e:
        logger.exception("daily_stats.query_failed", error=str(e))
        return

    def fmt_time(sec) -> str:
        if not sec:
            return "0m"
        h = sec // 3600
        m = (sec % 3600) // 60
        return f"{h}h {m}m" if h else f"{m}m"

    embed = discord.Embed(
        title="📊 Ежедневный отчёт",
        color=0x5865F2,
        timestamp=datetime.now(timezone.utc),
    )
    embed.add_field(
        name="Голосовая активность",
        value=(
            f"👥 Участников: **{stats['unique_users']}**\n"
            f"🔊 Сессий: **{stats['total_sessions']}**\n"
            f"⏱️ Суммарно: **{fmt_time(stats['total_voice_seconds'])}**"
        ),
        inline=True,
    )

    if action_breakdown:
        breakdown_lines = "\n".join(
            f"`{r['action_type']}`: {r['cnt']}" for r in action_breakdown
        )
        actions_value = f"⚡ Всего: **{stats['total_actions']}**\n{breakdown_lines}"
    else:
        actions_value = "Нет действий"

    embed.add_field(name="Действия бота", value=actions_value, inline=True)

    if top_mute:
        guild_id = getattr(bot, "guild_id", None)
        guild = bot.get_guild(guild_id) if guild_id else None
        member = guild.get_member(top_mute["discord_id"]) if guild else None
        name = member.display_name if member else str(top_mute["discord_id"])
        embed.add_field(
            name="🔇 Чемпион тишины",
            value=f"**{name}** — {fmt_time(top_mute['total_sec'])} в муте",
            inline=False,
        )

    embed.set_footer(text="За последние 24 часа")
    try:
        await notifier.send_daily(embed)
        logger.info("daily_stats.sent")
    except Exception as e:
        logger.exception("daily_stats.send_failed", error=str(e))


async def _send_weekly_report(pool: asyncpg.Pool) -> None:
    """Отправить еженедельный отчёт в лог-канал."""
    from src.bot.notifier import get_notifier
    from src.bot.embeds import build_weekly_report_embed

    notifier = get_notifier()
    if not notifier:
        return
    try:
        stats = await stats_repo.get_weekly_stats(pool)
        embed = build_weekly_report_embed(stats)
        await notifier.send(embed)
        logger.info("weekly_report_sent")
    except Exception as e:
        logger.exception("weekly_report_failed", error=str(e))


def register_weekly_report_job(
    scheduler: AsyncIOScheduler,
    pool: asyncpg.Pool,
    timezone: str = "UTC",
) -> None:
    """Зарегистрировать задачу еженедельного отчёта (каждое воскресенье в 00:00)."""
    scheduler.add_job(
        _send_weekly_report,
        trigger=CronTrigger(day_of_week="sun", hour=0, minute=0, timezone=timezone),
        args=[pool],
        id="weekly_report",
        name="weekly_report",
        replace_existing=True,
    )
    logger.info("weekly_report_job_registered", timezone=timezone)


async def start_scheduler(
    pool: asyncpg.Pool,
    scheduler: AsyncIOScheduler,
    report_timezone: str = "UTC",
) -> None:
    """
    Зарегистрировать cron-задачи из таблицы schedules и запустить планировщик.
    Вызывать после setup_scheduler, когда event loop уже запущен.
    """
    await _register_schedule_jobs(pool, scheduler)
    register_weekly_report_job(scheduler, pool, timezone=report_timezone)
    scheduler.start()
    logger.info("scheduler_started")


def shutdown_scheduler() -> None:
    """Остановить планировщик."""
    s = _get_scheduler()
    s.shutdown(wait=True)
    logger.info("scheduler_stopped")
