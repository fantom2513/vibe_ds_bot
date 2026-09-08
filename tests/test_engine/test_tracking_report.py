"""Тесты расчёта статистики отслеживаемых участников."""
from datetime import datetime, time, timezone

import pytest

from src.engine.tracking_report import (
    MemberSchedule,
    Session,
    calculate_all_together_seconds,
    calculate_daily_work_seconds,
    calculate_member_totals,
    calculate_pair_overlaps,
    daily_boundaries,
    period_bounds,
)


def dt(value: str) -> datetime:
    """Создать UTC-время для читаемых тестовых сценариев."""
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def test_member_work_seconds_are_clipped_to_msk_window() -> None:
    """Учитывается только пересечение с Пн–Пт 09:00–18:00 по Москве."""
    schedule = MemberSchedule(
        work_days={0, 1, 2, 3, 4},
        work_start=time(9),
        work_end=time(18),
        timezone="Europe/Moscow",
    )
    totals = calculate_member_totals(
        sessions=[Session(1, 10, dt("2026-08-03T08:30:00Z"), dt("2026-08-03T10:00:00Z"))],
        schedules={1: schedule},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert totals[1].total_seconds == 5400
    assert totals[1].session_count == 1
    assert totals[1].work_seconds == 5400


def test_member_work_seconds_exclude_weekend() -> None:
    """Воскресная сессия не попадает в рабочее время графика Пн–Пт."""
    schedule = MemberSchedule({0, 1, 2, 3, 4}, time(9), time(18), "Europe/Moscow")
    totals = calculate_member_totals(
        sessions=[Session(1, 10, dt("2026-08-02T08:00:00Z"), dt("2026-08-02T10:00:00Z"))],
        schedules={1: schedule},
        period_start=dt("2026-08-02T00:00:00Z"),
        period_end=dt("2026-08-03T00:00:00Z"),
    )

    assert totals[1].work_seconds == 0


def test_pair_overlap_counts_only_same_channel_intersection() -> None:
    """Стак — это пересечение двух отслеживаемых участников в одном канале."""
    overlaps = calculate_pair_overlaps(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(2, 10, dt("2026-08-03T09:30:00Z"), dt("2026-08-03T10:30:00Z")),
            Session(3, 11, dt("2026-08-03T09:30:00Z"), dt("2026-08-03T10:30:00Z")),
        ],
        tracked_member_ids={1, 2, 3},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert [(item.member_ids, item.seconds) for item in overlaps] == [
        ((1, 2), 1800),
    ]


def test_pair_overlap_sums_seconds_across_multiple_channels_for_same_pair() -> None:
    """Одна и та же пара пересеклась в двух разных каналах — одна строка, секунды суммируются."""
    overlaps = calculate_pair_overlaps(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T09:30:00Z")),
            Session(2, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T09:30:00Z")),
            Session(1, 11, dt("2026-08-03T14:00:00Z"), dt("2026-08-03T14:20:00Z")),
            Session(2, 11, dt("2026-08-03T14:00:00Z"), dt("2026-08-03T14:20:00Z")),
        ],
        tracked_member_ids={1, 2},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert [(item.member_ids, item.seconds) for item in overlaps] == [
        ((1, 2), 1800 + 1200),
    ]


def test_all_together_counts_only_the_window_when_every_tracked_member_present() -> None:
    """"Все вместе" — интервал, где присутствуют ВСЕ отслеживаемые, не просто пара."""
    seconds = calculate_all_together_seconds(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(2, 10, dt("2026-08-03T09:30:00Z"), dt("2026-08-03T10:30:00Z")),
        ],
        tracked_member_ids={1, 2},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert seconds == 1800  # 09:30–10:00, единственный момент, когда оба вместе


def test_all_together_is_zero_when_not_everyone_ever_overlaps() -> None:
    """Если хотя бы один из отслеживаемых ни разу не пересёкся с остальными — 0."""
    seconds = calculate_all_together_seconds(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(2, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(3, 10, dt("2026-08-03T11:00:00Z"), dt("2026-08-03T12:00:00Z")),
        ],
        tracked_member_ids={1, 2, 3},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert seconds == 0


def test_all_together_sums_disjoint_windows_across_channels() -> None:
    """Все вместе встречаются дважды в разных каналах — секунды суммируются."""
    seconds = calculate_all_together_seconds(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T09:30:00Z")),
            Session(2, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T09:30:00Z")),
            Session(1, 11, dt("2026-08-03T14:00:00Z"), dt("2026-08-03T14:20:00Z")),
            Session(2, 11, dt("2026-08-03T14:00:00Z"), dt("2026-08-03T14:20:00Z")),
        ],
        tracked_member_ids={1, 2},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert seconds == 1800 + 1200  # 30 мин в канале 10 + 20 мин в канале 11


def test_all_together_ignores_untracked_members_in_the_same_channel() -> None:
    """Посторонний (не из tracked_member_ids) в канале не мешает и не учитывается."""
    seconds = calculate_all_together_seconds(
        sessions=[
            Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(2, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
            Session(999, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z")),
        ],
        tracked_member_ids={1, 2},
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert seconds == 3600


def test_daily_work_seconds_buckets_one_entry_per_day_boundary() -> None:
    """Один словарь {discord_id: work_seconds} на каждую переданную границу дня."""
    schedule = MemberSchedule({0, 1, 2, 3, 4, 5, 6}, time(0), time(23, 59, 59), "UTC")
    sessions = [
        Session(1, 10, dt("2026-08-03T10:00:00Z"), dt("2026-08-03T11:00:00Z")),  # день 1: 1ч
        Session(1, 10, dt("2026-08-04T10:00:00Z"), dt("2026-08-04T10:30:00Z")),  # день 2: 30мин
    ]

    daily = calculate_daily_work_seconds(
        sessions=sessions,
        schedules={1: schedule},
        day_starts=[dt("2026-08-03T00:00:00Z"), dt("2026-08-04T00:00:00Z")],
    )

    assert daily == [{1: 3600}, {1: 1800}]


def test_daily_work_seconds_empty_day_gives_zero_not_missing_key() -> None:
    """День без сессий участника всё равно присутствует в результате, с нулём."""
    schedule = MemberSchedule({0, 1, 2, 3, 4, 5, 6}, time(0), time(23, 59, 59), "UTC")

    daily = calculate_daily_work_seconds(
        sessions=[],
        schedules={1: schedule},
        day_starts=[dt("2026-08-03T00:00:00Z")],
    )

    assert daily == [{1: 0}]


def test_daily_boundaries_returns_requested_count_ending_today() -> None:
    """N границ дней (00:00 в указанной TZ), от самого старого к сегодняшнему."""
    now = dt("2026-08-30T12:00:00Z")
    boundaries = daily_boundaries(3, now, "UTC")

    assert boundaries == [
        dt("2026-08-28T00:00:00Z"),
        dt("2026-08-29T00:00:00Z"),
        dt("2026-08-30T00:00:00Z"),
    ]


def test_daily_boundaries_respects_timezone_for_day_cutoff() -> None:
    """00:00 по указанному часовому поясу, не по UTC."""
    now = dt("2026-08-30T18:30:00Z")  # 21:30 по Москве — всё ещё 30 августа
    boundaries = daily_boundaries(1, now, "Europe/Moscow")

    assert boundaries == [dt("2026-08-29T21:00:00Z")]  # 00:00 30.08 МСК = 21:00 29.08 UTC


def test_period_bounds_today_starts_at_local_midnight() -> None:
    """"today" остаётся календарным — с полуночи по указанному TZ до `now`."""
    now = dt("2026-09-08T18:30:00Z")  # 21:30 по Москве, всё ещё 8 сентября
    start, end = period_bounds("today", now, "Europe/Moscow")

    assert start == dt("2026-09-07T21:00:00Z")  # 00:00 08.09 МСК = 21:00 07.09 UTC
    assert end == now


def test_period_bounds_week_is_rolling_seven_days() -> None:
    """"week" — плавающее окно последних 7×24ч, а не с понедельника этой недели."""
    now = dt("2026-09-08T18:30:00Z")
    start, end = period_bounds("week", now, "Europe/Moscow")

    assert start == dt("2026-09-01T18:30:00Z")
    assert end == now


def test_period_bounds_month_is_rolling_thirty_days() -> None:
    """"month" — плавающее окно последних 30×24ч, а не с 1-го числа календарного месяца."""
    now = dt("2026-09-08T18:30:00Z")
    start, end = period_bounds("month", now, "Europe/Moscow")

    assert start == dt("2026-08-09T18:30:00Z")
    assert end == now


def test_period_bounds_rejects_unknown_period() -> None:
    """Неизвестный период — явная ошибка, а не тихий фолбэк."""
    with pytest.raises(ValueError):
        period_bounds("year", dt("2026-09-08T18:30:00Z"))


def test_all_together_returns_zero_for_empty_tracked_set() -> None:
    """Пустой набор отслеживаемых — 0, без деления на ноль и прочих сюрпризов."""
    seconds = calculate_all_together_seconds(
        sessions=[Session(1, 10, dt("2026-08-03T09:00:00Z"), dt("2026-08-03T10:00:00Z"))],
        tracked_member_ids=set(),
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
    )

    assert seconds == 0
