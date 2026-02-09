"""
Тесты оценщика правил: при пользователе в blacklist и правиле kick — действие kick;
при пользователе не в списке — пустой список.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.engine.evaluator import evaluate
from src.engine.rules import Rule


@pytest.fixture
def mock_channel():
    """Мок голосового канала."""
    ch = MagicMock()
    ch.id = 100500
    return ch


@pytest.fixture
def rule_kick_blacklist():
    """Правило: blacklist -> kick."""
    return Rule(
        id=1,
        name="Kick blacklist",
        is_active=True,
        target_list="blacklist",
        channel_ids=None,
        max_time_sec=None,
        action_type="kick",
        action_params={},
        priority=0,
    )


@pytest.mark.asyncio
async def test_evaluate_returns_kick_when_user_in_blacklist(
    mock_member, mock_channel, rule_kick_blacklist
):
    """При пользователе в blacklist и правиле kick evaluate возвращает действие kick."""
    users_repo = MagicMock()
    users_repo.is_in_list = AsyncMock(return_value=True)
    pool = MagicMock()

    result = await evaluate(
        mock_member, mock_channel, [rule_kick_blacklist], users_repo, pool
    )

    assert len(result) == 1
    assert result[0].action_type == "kick"
    assert result[0].rule_id == 1
    users_repo.is_in_list.assert_called_once_with(pool, mock_member.id, "blacklist")


@pytest.mark.asyncio
async def test_evaluate_returns_empty_when_user_not_in_list(
    mock_member, mock_channel, rule_kick_blacklist
):
    """При пользователе не в blacklist evaluate возвращает пустой список."""
    users_repo = MagicMock()
    users_repo.is_in_list = AsyncMock(return_value=False)
    pool = MagicMock()

    result = await evaluate(
        mock_member, mock_channel, [rule_kick_blacklist], users_repo, pool
    )

    assert len(result) == 0
    users_repo.is_in_list.assert_called_once_with(pool, mock_member.id, "blacklist")
