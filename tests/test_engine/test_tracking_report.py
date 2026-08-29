"""Тесты расчёта статистики отслеживаемых участников."""
from datetime import datetime, time, timezone

from src.engine.tracking_report import (
    MemberSchedule,
    Session,
    calculate_member_totals,
    calculate_pair_overlaps,
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

    assert [(item.member_ids, item.channel_id, item.seconds) for item in overlaps] == [
        ((1, 2), 10, 1800),
    ]
