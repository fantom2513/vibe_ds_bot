"""
Тесты трекера голосовых сессий: start_session, end_session, get_current_sessions, get_overtime_users.
"""
from datetime import datetime, timedelta, timezone

import pytest

from src.engine import tracker as tracker_mod


@pytest.mark.asyncio
async def test_start_session_adds_record_with_left_at_null(pool, clear_tracker_sessions):
    """После start_session(pool, discord_id, channel_id) в voice_sessions есть запись с left_at=NULL."""
    await tracker_mod.start_session(pool, 111, 222)
    assert len(pool.voice_sessions) == 1
    assert pool.voice_sessions[0]["discord_id"] == 111
    assert pool.voice_sessions[0]["channel_id"] == 222
    assert pool.voice_sessions[0]["left_at"] is None
    assert pool.voice_sessions[0]["joined_at"] is not None


@pytest.mark.asyncio
async def test_end_session_updates_left_at(pool, clear_tracker_sessions):
    """После end_session запись обновлена: left_at установлен."""
    await tracker_mod.start_session(pool, 333, 444)
    assert pool.voice_sessions[0]["left_at"] is None
    await tracker_mod.end_session(pool, 333, 444)
    assert len(pool.voice_sessions) == 1
    assert pool.voice_sessions[0]["left_at"] is not None


@pytest.mark.asyncio
async def test_get_current_sessions_returns_active(pool, clear_tracker_sessions):
    """get_current_sessions возвращает только активные сессии (из памяти)."""
    assert tracker_mod.get_current_sessions() == []
    await tracker_mod.start_session(pool, 1, 10)
    await tracker_mod.start_session(pool, 2, 10)
    sessions = tracker_mod.get_current_sessions()
    assert len(sessions) == 2
    ids_channels = {(s[0], s[1]) for s in sessions}
    assert (1, 10) in ids_channels
    assert (2, 10) in ids_channels
    await tracker_mod.end_session(pool, 1, 10)
    sessions2 = tracker_mod.get_current_sessions()
    assert len(sessions2) == 1
    assert sessions2[0][0] == 2 and sessions2[0][1] == 10


@pytest.mark.asyncio
async def test_get_overtime_users_returns_list_when_over_max_time(pool, clear_tracker_sessions):
    """get_overtime_users при переданных rules с max_time_sec возвращает список при превышении времени."""
    await tracker_mod.start_session(pool, 555, 666)
    # Подменить joined_at в памяти трекера на "давно", чтобы длительность >= max_time_sec
    key = (555, 666)
    assert key in tracker_mod._sessions
    old_time = datetime.now(timezone.utc) - timedelta(seconds=100)
    tracker_mod._sessions[key] = old_time

    rules = [
        {"max_time_sec": 60, "channel_ids": [666], "id": 1, "action_type": "mute", "action_params": {}},
    ]
    result = await tracker_mod.get_overtime_users(pool, rules)
    assert len(result) >= 1
    entry = result[0]
    assert entry["discord_id"] == 555
    assert entry["channel_id"] == 666
    assert entry["rule"] == rules[0]
    assert entry["overtime_seconds"] >= 39
