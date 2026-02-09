"""
Тест on_voice_state_update: вызываются tracker.start_session или end_session (мок трекера), без исключений.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.bot.cogs.voice_manager import VoiceManager


@pytest.fixture
def mock_bot_with_tracker(pool):
    """Бот с моками pool и tracker (start_session, end_session — AsyncMock)."""
    bot = MagicMock()
    bot.pool = pool
    tracker = MagicMock()
    tracker.start_session = AsyncMock()
    tracker.end_session = AsyncMock()
    bot.tracker = tracker
    bot.rules_repo = None
    bot.users_repo = None
    bot.logs_repo = None
    bot.evaluator = None
    bot.actions = None
    return bot


@pytest.mark.asyncio
async def test_voice_state_update_join_calls_start_session(
    mock_member, mock_bot_with_tracker, pool
):
    """При входе в канал (after.channel не None) вызывается tracker.start_session."""
    cog = VoiceManager(mock_bot_with_tracker)
    before = MagicMock()
    before.channel = None
    after = MagicMock()
    after.channel = MagicMock()
    after.channel.id = 999

    await cog.on_voice_state_update(mock_member, before, after)

    mock_bot_with_tracker.tracker.start_session.assert_called_once_with(
        pool, mock_member.id, 999
    )
    mock_bot_with_tracker.tracker.end_session.assert_not_called()


@pytest.mark.asyncio
async def test_voice_state_update_leave_calls_end_session(
    mock_member, mock_bot_with_tracker, pool
):
    """При выходе из канала (before.channel есть, after.channel None) вызывается tracker.end_session."""
    cog = VoiceManager(mock_bot_with_tracker)
    before = MagicMock()
    before.channel = MagicMock()
    before.channel.id = 888
    after = MagicMock()
    after.channel = None

    await cog.on_voice_state_update(mock_member, before, after)

    mock_bot_with_tracker.tracker.end_session.assert_called_once_with(
        pool, mock_member.id, 888
    )
    mock_bot_with_tracker.tracker.start_session.assert_not_called()


@pytest.mark.asyncio
async def test_voice_state_update_no_exception_when_pool_or_tracker_missing(mock_member):
    """При отсутствии pool или tracker обработчик не бросает исключение."""
    bot = MagicMock()
    bot.pool = None
    bot.tracker = None
    cog = VoiceManager(bot)
    before = MagicMock()
    before.channel = None
    after = MagicMock()
    after.channel = MagicMock()
    after.channel.id = 1

    await cog.on_voice_state_update(mock_member, before, after)

    # Не должно быть исключения; start_session не вызывается (нет tracker)
    assert bot.tracker is None
