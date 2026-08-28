"""Контракт slash-команды публикации отчёта отслеживания."""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.bot.cogs import admin_commands
from src.bot.cogs.admin_commands import TrackingGroup
from src.engine.tracking_report import Session


@pytest.fixture
def mock_bot() -> MagicMock:
    bot = MagicMock()
    bot.pool = MagicMock()
    bot.get_channel = MagicMock()
    return bot


@pytest.fixture
def interaction() -> MagicMock:
    value = MagicMock()
    value.response.defer = AsyncMock()
    value.followup.send = AsyncMock()
    value.user.id = 123
    return value


@pytest.mark.asyncio
async def test_tracking_report_posts_member_totals_and_stacks_to_configured_channel(
    mock_bot: MagicMock, interaction: MagicMock, monkeypatch: pytest.MonkeyPatch,
) -> None:
    channel = MagicMock()
    channel.send = AsyncMock()
    mock_bot.get_channel.return_value = channel
    members = [
        {
            "discord_id": 42,
            "username": "Ada",
            "is_active": True,
            "work_days": [0, 1, 2, 3, 4],
            "work_start": "09:00",
            "work_end": "18:00",
            "timezone": "Europe/Moscow",
        },
        {
            "discord_id": 43,
            "username": "Bob",
            "is_active": True,
            "work_days": [0, 1, 2, 3, 4],
            "work_start": "09:00",
            "work_end": "18:00",
            "timezone": "Europe/Moscow",
        },
    ]
    session = Session(
        42,
        10,
        datetime(2026, 8, 28, 9, tzinfo=timezone.utc),
        datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "list_tracked_members", AsyncMock(return_value=members)
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=[session])
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    channel.send.assert_awaited_once()
    embed = channel.send.await_args.kwargs["embed"]
    fields = {field.name: field.value for field in embed.fields}
    assert "today" in embed.title
    assert fields["Ada"] == "Всего: 1h 0m\nСессий: 1\nРабочее: 1h 0m"
    assert fields["Bob"] == "Всего: 0m\nСессий: 0\nРабочее: 0m"
    assert fields["Стаки"] == "Нет пересечений"
    interaction.followup.send.assert_awaited_with("Отчёт отправлен в <#777>.", ephemeral=True)


@pytest.mark.asyncio
async def test_tracking_report_explains_missing_channel(
    mock_bot: MagicMock, interaction: MagicMock, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": None}),
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    interaction.followup.send.assert_awaited_with(
        "Сначала выберите канал отчётов в админке.", ephemeral=True
    )
