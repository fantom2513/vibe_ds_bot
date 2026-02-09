"""
Тесты модуля действий: mute вызывает member.edit(mute=True);
при member.id == guild.owner_id execute_action возвращает False и не вызывает edit.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.engine.actions import execute_action


@pytest.mark.asyncio
async def test_execute_action_mute_calls_edit(mock_member, mock_guild):
    """При action_type mute вызывается member.edit(mute=True)."""
    mock_member.edit = AsyncMock()
    mock_member.id = 12345
    mock_guild.owner_id = 99999

    result = await execute_action("mute", mock_member, {}, mock_guild)

    assert result is True
    mock_member.edit.assert_called_once_with(mute=True)


@pytest.mark.asyncio
async def test_execute_action_returns_false_for_owner_and_no_edit(mock_member, mock_guild):
    """При member.id == guild.owner_id execute_action возвращает False и не вызывает edit."""
    mock_member.edit = AsyncMock()
    mock_member.id = 111222333
    mock_guild.owner_id = 111222333

    result = await execute_action("mute", mock_member, {}, mock_guild)

    assert result is False
    mock_member.edit.assert_not_called()
