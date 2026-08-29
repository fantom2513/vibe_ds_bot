"""Расчёт статистики отслеживаемых участников по голосовым сессиям."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
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
    channel_id: int
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
    """Посчитать пересечения сессий разных участников в одном голосовом канале."""
    sessions_by_channel: dict[int, list[Session]] = {}
    for session in sessions:
        if session.discord_id not in tracked_member_ids:
            continue
        clipped = _clip_session(session, period_start, period_end)
        if clipped is not None:
            sessions_by_channel.setdefault(clipped.channel_id, []).append(clipped)

    totals: dict[tuple[tuple[int, int], int], int] = {}
    for channel_id, channel_sessions in sessions_by_channel.items():
        for first, second in combinations(channel_sessions, 2):
            if first.discord_id == second.discord_id:
                continue
            seconds = _seconds_between(
                max(first.joined_at, second.joined_at),
                min(first.left_at, second.left_at),
            )
            if seconds:
                member_ids = tuple(sorted((first.discord_id, second.discord_id)))
                key = (member_ids, channel_id)
                totals[key] = totals.get(key, 0) + seconds

    return [
        PairOverlap(member_ids=member_ids, channel_id=channel_id, seconds=seconds)
        for (member_ids, channel_id), seconds in sorted(totals.items())
    ]
