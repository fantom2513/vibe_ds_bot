"""Тесты хранения конфигурации и сессий отслеживаемых участников."""
from datetime import datetime, timezone

import pytest

from src.db.repositories import tracking_repo


def dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


@pytest.mark.asyncio
async def test_create_tracked_member_applies_default_msk_schedule(pool) -> None:
    row = await tracking_repo.create_tracked_member(
        pool,
        {"discord_id": 42, "username": "Ada"},
    )

    assert row["discord_id"] == 42
    assert row["work_days"] == [0, 1, 2, 3, 4]
    assert row["work_start"] == "09:00:00"
    assert row["work_end"] == "18:00:00"
    assert row["timezone"] == "Europe/Moscow"


@pytest.mark.asyncio
async def test_load_report_sessions_clips_open_session_at_report_time(pool) -> None:
    pool.voice_sessions = [
        {
            "discord_id": 42,
            "channel_id": 9,
            "joined_at": dt("2026-08-03T10:00:00Z"),
            "left_at": None,
        },
    ]

    sessions = await tracking_repo.load_report_sessions(
        pool,
        member_ids=[42],
        period_start=dt("2026-08-03T00:00:00Z"),
        period_end=dt("2026-08-04T00:00:00Z"),
        now=dt("2026-08-03T12:00:00Z"),
    )

    assert len(sessions) == 1
    assert sessions[0].left_at == dt("2026-08-03T12:00:00Z")
