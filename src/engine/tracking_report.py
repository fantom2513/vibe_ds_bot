"""Расчёт статистики отслеживаемых участников по голосовым сессиям."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from itertools import combinations
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Session:
    discord_id: int
    channel_id: int
    joined_at: datetime
    left_at: datetime


@dataclass(frozen=True)
class MemberSchedule:
    work_days: set[int]
    work_start: time
    work_end: time
    timezone: str


@dataclass(frozen=True)
class MemberTotal:
    total_seconds: int
    session_count: int
    work_seconds: int


@dataclass(frozen=True)
class PairOverlap:
    member_ids: tuple[int, int]
    seconds: int


def _clip_session(session: Session, period_start: datetime, period_end: datetime) -> Session | None:
    joined_at = max(session.joined_at, period_start)
    left_at = min(session.left_at, period_end)
    if joined_at >= left_at:
        return None
    return Session(session.discord_id, session.channel_id, joined_at, left_at)


def _seconds_between(start: datetime, end: datetime) -> int:
    return max(0, int((end - start).total_seconds()))


def _work_seconds(session: Session, schedule: MemberSchedule) -> int:
    timezone = ZoneInfo(schedule.timezone)
    local_start = session.joined_at.astimezone(timezone)
    local_end = session.left_at.astimezone(timezone)
    day = local_start.date()
    last_day = local_end.date()
    seconds = 0

    while day <= last_day:
        if day.weekday() in schedule.work_days:
            window_start = datetime.combine(day, schedule.work_start, tzinfo=timezone)
            window_end = datetime.combine(day, schedule.work_end, tzinfo=timezone)
            overlap_start = max(session.joined_at, window_start.astimezone(session.joined_at.tzinfo))
            overlap_end = min(session.left_at, window_end.astimezone(session.left_at.tzinfo))
            seconds += _seconds_between(overlap_start, overlap_end)
        day += timedelta(days=1)

    return seconds


def calculate_member_totals(
    sessions: list[Session],
    schedules: dict[int, MemberSchedule],
    period_start: datetime,
    period_end: datetime,
) -> dict[int, MemberTotal]:
    """Посчитать общее и рабочее время для каждого настроенного участника."""
    accumulators = {
        member_id: {"total_seconds": 0, "session_count": 0, "work_seconds": 0}
        for member_id in schedules
    }

    for session in sessions:
        schedule = schedules.get(session.discord_id)
        if schedule is None:
            continue
        clipped = _clip_session(session, period_start, period_end)
        if clipped is None:
            continue
        accumulator = accumulators[session.discord_id]
        accumulator["total_seconds"] += _seconds_between(clipped.joined_at, clipped.left_at)
        accumulator["session_count"] += 1
        accumulator["work_seconds"] += _work_seconds(clipped, schedule)

    return {
        member_id: MemberTotal(**accumulator)
        for member_id, accumulator in accumulators.items()
    }


def calculate_pair_overlaps(
    sessions: list[Session],
    tracked_member_ids: set[int],
    period_start: datetime,
    period_end: datetime,
) -> list[PairOverlap]:
    """
    Посчитать пересечения сессий разных участников в одном голосовом канале.
    Одна пара может пересекаться в нескольких разных каналах за период — секунды
    суммируются в одну запись на пару, без разбивки по каналам.
    """
    sessions_by_channel: dict[int, list[Session]] = {}
    for session in sessions:
        if session.discord_id not in tracked_member_ids:
            continue
        clipped = _clip_session(session, period_start, period_end)
        if clipped is not None:
            sessions_by_channel.setdefault(clipped.channel_id, []).append(clipped)

    totals: dict[tuple[int, int], int] = {}
    for channel_sessions in sessions_by_channel.values():
        for first, second in combinations(channel_sessions, 2):
            if first.discord_id == second.discord_id:
                continue
            seconds = _seconds_between(
                max(first.joined_at, second.joined_at),
                min(first.left_at, second.left_at),
            )
            if seconds:
                member_ids = tuple(sorted((first.discord_id, second.discord_id)))
                totals[member_ids] = totals.get(member_ids, 0) + seconds

    return [
        PairOverlap(member_ids=member_ids, seconds=seconds)
        for member_ids, seconds in sorted(totals.items())
    ]


def period_bounds(
    period: str, now: datetime, tz_name: str = "Europe/Moscow",
) -> tuple[datetime, datetime]:
    """
    Границы периода для отчётов (preview на дашборде и /tracking report у бота):
    - "today" — календарный, с полуночи по tz_name до `now`;
    - "week"/"month" — плавающее окно от `now` назад (последние 7×24ч / 30×24ч),
      а не с понедельника этой недели или с 1-го числа календарного месяца.
    """
    if period == "today":
        tz = ZoneInfo(tz_name)
        start = datetime.combine(now.astimezone(tz).date(), time.min, tz).astimezone(timezone.utc)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    else:
        raise ValueError(f"Unknown period: {period}")
    return start, now


def daily_boundaries(days: int, now: datetime, tz_name: str = "Europe/Moscow") -> list[datetime]:
    """
    Границы последних `days` календарных дней (00:00 в tz_name, в UTC),
    от самого старого к сегодняшнему включительно. Общий хелпер для API
    и /report-команды бота — единая точка расчёта 14-дневного окна.
    """
    tz = ZoneInfo(tz_name)
    today = now.astimezone(tz).date()
    return [
        datetime.combine(today - timedelta(days=offset), time.min, tz).astimezone(timezone.utc)
        for offset in range(days - 1, -1, -1)
    ]


def calculate_daily_work_seconds(
    sessions: list[Session],
    schedules: dict[int, MemberSchedule],
    day_starts: list[datetime],
) -> list[dict[int, int]]:
    """
    Для 14-дневного графика: по одному {discord_id: work_seconds} на каждую
    границу дня из day_starts (начало дня в UTC, конец = +24ч). Переиспользует
    calculate_member_totals — один вызов на день, без дублирования логики
    бакетинга по локальному дню участника.
    """
    return [
        {
            member_id: total.work_seconds
            for member_id, total in calculate_member_totals(
                sessions, schedules, day_start, day_start + timedelta(days=1),
            ).items()
        }
        for day_start in day_starts
    ]


def calculate_all_together_seconds(
    sessions: list[Session],
    tracked_member_ids: set[int],
    period_start: datetime,
    period_end: datetime,
) -> int:
    """
    Суммарное время, когда ВСЕ отслеживаемые участники были одновременно
    в одном и том же голосовом канале. Не привязано к конкретному каналу —
    если "все вместе" случалось в разных каналах в разное время, секунды
    суммируются по всем таким интервалам.
    """
    if not tracked_member_ids:
        return 0

    sessions_by_channel: dict[int, list[Session]] = {}
    for session in sessions:
        if session.discord_id not in tracked_member_ids:
            continue
        clipped = _clip_session(session, period_start, period_end)
        if clipped is not None:
            sessions_by_channel.setdefault(clipped.channel_id, []).append(clipped)

    required = len(tracked_member_ids)
    total_seconds = 0

    for channel_sessions in sessions_by_channel.values():
        # (время, delta, discord_id); delta=-1 (leave) идёт перед +1 (join) в один момент
        events = sorted(
            (
                (endpoint, delta, s.discord_id)
                for s in channel_sessions
                for endpoint, delta in ((s.joined_at, 1), (s.left_at, -1))
            ),
            key=lambda event: (event[0], event[1]),
        )

        active: dict[int, int] = {}
        full_start: datetime | None = None
        for time_point, delta, discord_id in events:
            was_full = len(active) == required

            if delta == 1:
                active[discord_id] = active.get(discord_id, 0) + 1
            else:
                active[discord_id] -= 1
                if active[discord_id] == 0:
                    del active[discord_id]
            is_full = len(active) == required

            if was_full and not is_full:
                total_seconds += _seconds_between(full_start, time_point)
                full_start = None
            elif is_full and not was_full:
                full_start = time_point

    return total_seconds
