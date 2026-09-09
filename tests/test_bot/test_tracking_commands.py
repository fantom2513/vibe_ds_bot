"""Контракт slash-команды публикации отчёта отслеживания."""
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import discord
import pytest

from src.bot.cogs import admin_commands
from src.bot.cogs.admin_commands import TrackingGroup
from src.engine.tracking_report import Session


REPORT_NOW = datetime(2026, 8, 28, 12, tzinfo=timezone.utc)


class ReportDateTime(datetime):
    """Real datetime type with a deterministic report-command clock."""

    @classmethod
    def now(cls, tz=None) -> datetime:
        if tz is None:
            return REPORT_NOW.replace(tzinfo=None)
        return REPORT_NOW.astimezone(tz)


def freeze_report_clock(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep report-command fixtures anchored to their fixed session date."""
    monkeypatch.setattr(admin_commands, "datetime", ReportDateTime)


@pytest.fixture
def mock_bot() -> MagicMock:
    bot = MagicMock()
    bot.pool = MagicMock()
    bot.get_channel = MagicMock()
    bot.fetch_channel = AsyncMock()
    return bot


@pytest.fixture
def interaction() -> MagicMock:
    value = MagicMock()
    value.response.defer = AsyncMock()
    value.followup.send = AsyncMock()
    value.user.id = 123
    value.user.guild_permissions.administrator = True
    return value


@pytest.fixture
def sendable_channel() -> MagicMock:
    channel = MagicMock(spec=discord.TextChannel)
    channel.send = AsyncMock()
    channel.guild.me = MagicMock()
    channel.permissions_for.return_value.send_messages = True
    return channel


def tracked_member(discord_id: int, username: str | None) -> dict[str, Any]:
    return {
        "discord_id": discord_id,
        "username": username,
        "is_active": True,
        "work_days": [0, 1, 2, 3, 4],
        "work_start": "09:00",
        "work_end": "18:00",
        "timezone": "Europe/Moscow",
    }


@pytest.mark.asyncio
async def test_tracking_report_posts_member_totals_and_stacks_to_configured_channel(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = sendable_channel
    freeze_report_clock(monkeypatch)
    members = [
        tracked_member(42, "Ada"),
        tracked_member(43, "Bob"),
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

    sendable_channel.send.assert_awaited_once()
    embed = sendable_channel.send.await_args.kwargs["embed"]
    fields = {field.name: field.value for field in embed.fields}
    assert "today" in embed.title
    assert fields["Ada"] == "Всего: 1h 0m\nСессий: 1\nРабочее: 1h 0m"
    assert fields["Bob"] == "Всего: 0m\nСессий: 0\nРабочее: 0m"
    assert fields["Стаки"] == "Нет пересечений"
    interaction.followup.send.assert_awaited_with("Отчёт отправлен в <#777>.", ephemeral=True)


@pytest.mark.asyncio
async def test_tracking_report_attaches_work_hours_chart_image(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = sendable_channel
    freeze_report_clock(monkeypatch)
    members = [tracked_member(42, "Ada")]
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "list_tracked_members", AsyncMock(return_value=members)
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=[])
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    kwargs = sendable_channel.send.await_args.kwargs
    assert kwargs["file"].filename == "work_hours.png"
    assert kwargs["embed"].image.url == "attachment://work_hours.png"


@pytest.mark.asyncio
async def test_tracking_report_still_sends_when_chart_render_fails(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Падение рендера графика — отчёт всё равно уходит, просто без картинки."""
    mock_bot.get_channel.return_value = sendable_channel
    freeze_report_clock(monkeypatch)
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "list_tracked_members",
        AsyncMock(return_value=[tracked_member(42, "Ada")]),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=[])
    )
    monkeypatch.setattr(
        admin_commands, "render_daily_work_hours_chart",
        MagicMock(side_effect=RuntimeError("render exploded")),
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    kwargs = sendable_channel.send.await_args.kwargs
    assert "file" not in kwargs
    interaction.followup.send.assert_awaited_with("Отчёт отправлен в <#777>.", ephemeral=True)


@pytest.mark.asyncio
async def test_tracking_report_uses_discord_id_when_stored_username_is_missing(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = sendable_channel
    freeze_report_clock(monkeypatch)
    members = [tracked_member(42, None), tracked_member(43, "Bob")]
    sessions = [
        Session(42, 10, datetime(2026, 8, 28, 9, tzinfo=timezone.utc), datetime(2026, 8, 28, 10, tzinfo=timezone.utc)),
        Session(43, 10, datetime(2026, 8, 28, 9, tzinfo=timezone.utc), datetime(2026, 8, 28, 10, tzinfo=timezone.utc)),
    ]
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "list_tracked_members", AsyncMock(return_value=members)
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=sessions)
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    embed = sendable_channel.send.await_args.kwargs["embed"]
    fields = {field.name: field.value for field in embed.fields}
    assert fields["42"] == "Всего: 1h 0m\nСессий: 1\nРабочее: 1h 0m"
    assert fields["Стаки"] == "42 + Bob · 1h 0m"


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


@pytest.mark.asyncio
async def test_tracking_report_rejects_non_administrator_before_loading_report(
    mock_bot: MagicMock, interaction: MagicMock, monkeypatch: pytest.MonkeyPatch,
) -> None:
    interaction.user.guild_permissions.administrator = False
    settings = AsyncMock()
    monkeypatch.setattr(admin_commands.tracking_repo, "get_tracking_settings", settings)

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    settings.assert_not_awaited()
    interaction.followup.send.assert_awaited_with(
        "Эта команда доступна только администраторам.", ephemeral=True
    )


@pytest.mark.asyncio
async def test_tracking_report_limits_embed_fields_and_stack_length(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = sendable_channel
    members = [tracked_member(member_id, f"Member {member_id}") for member_id in range(1, 27)]
    sessions = [
        Session(
            member_id,
            10,
            datetime(2026, 8, 28, 9, tzinfo=timezone.utc),
            datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        for member_id in range(1, 27)
    ]
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "list_tracked_members", AsyncMock(return_value=members)
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=sessions)
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    embed = sendable_channel.send.await_args.kwargs["embed"]
    assert len(embed.fields) <= 25
    assert all(len(field.value) <= 1024 for field in embed.fields)
    assert any(field.name == "Участники" for field in embed.fields)


@pytest.mark.asyncio
async def test_tracking_report_fetches_sendable_channel_after_cache_miss(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = None
    mock_bot.fetch_channel.return_value = sendable_channel
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "list_tracked_members",
        AsyncMock(return_value=[tracked_member(42, "Ada")]),
    )
    monkeypatch.setattr(admin_commands.tracking_repo, "load_report_sessions", AsyncMock(return_value=[]))

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    mock_bot.fetch_channel.assert_awaited_once_with(777)
    sendable_channel.send.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("channel", [MagicMock(spec=discord.VoiceChannel), MagicMock(spec=discord.TextChannel)])
async def test_tracking_report_rejects_unavailable_or_unsendable_channel(
    mock_bot: MagicMock, interaction: MagicMock, channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if isinstance(channel, discord.TextChannel):
        channel.guild.me = MagicMock()
        channel.permissions_for.return_value.send_messages = False
    mock_bot.get_channel.return_value = channel
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    interaction.followup.send.assert_awaited_with("Канал отчётов недоступен.", ephemeral=True)


@pytest.mark.asyncio
async def test_tracking_report_returns_ephemeral_error_when_report_build_fails(
    mock_bot: MagicMock, interaction: MagicMock, sendable_channel: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    mock_bot.get_channel.return_value = sendable_channel
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "get_tracking_settings",
        AsyncMock(return_value={"report_channel_id": 777}),
    )
    monkeypatch.setattr(
        admin_commands.tracking_repo,
        "list_tracked_members",
        AsyncMock(side_effect=RuntimeError("database unavailable")),
    )

    group = TrackingGroup(mock_bot)
    await group.report.callback(group, interaction, "today")

    interaction.followup.send.assert_awaited_with(
        "Не удалось подготовить отчёт. Попробуйте позже.", ephemeral=True
    )
