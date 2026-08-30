"""Контракт API настройки отслеживаемых участников."""
from datetime import datetime, timezone
from unittest.mock import MagicMock

import discord
from httpx import ASGITransport, AsyncClient
from jose import jwt
import pytest

from src.api.app import app
from src.config.settings import get_settings


@pytest.fixture
def api_client(pool):
    app.state.pool = pool
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
def auth_cookies():
    settings = get_settings()
    token = jwt.encode({"sub": "123", "username": "TestAdmin"}, settings.JWT_SECRET, algorithm="HS256")
    return {"access_token": token}


@pytest.mark.asyncio
async def test_tracking_members_requires_authentication(api_client):
    async with api_client as client:
        response = await client.get("/api/tracking/members")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_and_list_tracked_members(api_client, auth_cookies):
    async with api_client as client:
        created = await client.post(
            "/api/tracking/members",
            cookies=auth_cookies,
            json={"discord_id": "42", "username": "Ada"},
        )
        listed = await client.get("/api/tracking/members", cookies=auth_cookies)

    assert created.status_code == 200
    assert created.json()["discord_id"] == "42"
    assert listed.json()[0]["username"] == "Ada"


@pytest.mark.asyncio
async def test_update_and_delete_tracked_member(api_client, auth_cookies):
    async with api_client as client:
        created = await client.post(
            "/api/tracking/members",
            cookies=auth_cookies,
            json={"discord_id": "42", "username": "Ada"},
        )
        updated = await client.patch(
            "/api/tracking/members/42",
            cookies=auth_cookies,
            json={"is_active": False, "work_days": [0, 2, 4]},
        )
        deleted = await client.delete("/api/tracking/members/42", cookies=auth_cookies)
        listed = await client.get("/api/tracking/members", cookies=auth_cookies)

    assert created.status_code == 200
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False
    assert deleted.status_code == 204
    assert listed.json() == []


@pytest.mark.asyncio
async def test_update_missing_tracked_member_returns_404(api_client, auth_cookies):
    async with api_client as client:
        response = await client.patch(
            "/api/tracking/members/404",
            cookies=auth_cookies,
            json={"username": "Missing"},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Tracked member not found"


@pytest.mark.asyncio
async def test_tracking_settings_round_trip(api_client, auth_cookies):
    async with api_client as client:
        initial = await client.get("/api/tracking/settings", cookies=auth_cookies)
        updated = await client.patch(
            "/api/tracking/settings",
            cookies=auth_cookies,
            json={"report_channel_id": None},
        )

    assert initial.status_code == 200
    assert initial.json()["report_channel_id"] is None
    assert updated.json()["report_channel_id"] is None


@pytest.mark.asyncio
async def test_text_channels_returns_only_cached_sendable_text_channels(api_client, auth_cookies, monkeypatch):
    sendable = MagicMock(spec=discord.TextChannel)
    sendable.id = 12
    sendable.name = "reports"
    sendable.permissions_for.return_value.send_messages = True
    blocked = MagicMock(spec=discord.TextChannel)
    blocked.id = 13
    blocked.name = "locked"
    blocked.permissions_for.return_value.send_messages = False
    guild = MagicMock()
    guild.text_channels = [sendable, blocked]
    guild.me = MagicMock()
    bot = MagicMock()
    bot.get_guild.return_value = guild
    app.state.bot = bot

    async with api_client as client:
        response = await client.get("/api/tracking/text-channels", cookies=auth_cookies)

    assert response.status_code == 200
    assert response.json() == [{"id": "12", "name": "reports"}]


@pytest.mark.asyncio
async def test_preview_returns_active_member_totals_and_overlaps(api_client, auth_cookies):
    now = datetime.now(timezone.utc)
    api_client._transport.app.state.pool.tracked_members = {
        42: {
            "discord_id": 42, "username": "Ada", "is_active": True,
            "work_days": [0, 1, 2, 3, 4], "work_start": "09:00:00", "work_end": "18:00:00",
            "timezone": "Europe/Moscow", "created_at": now, "updated_at": now,
        },
        43: {
            "discord_id": 43, "username": "Bob", "is_active": False,
            "work_days": [0, 1, 2, 3, 4], "work_start": "09:00:00", "work_end": "18:00:00",
            "timezone": "Europe/Moscow", "created_at": now, "updated_at": now,
        },
    }
    cached_member = MagicMock()
    cached_member.display_name = "Ada Renamed"
    guild = MagicMock()
    guild.get_member.side_effect = lambda discord_id: cached_member if discord_id == 42 else None
    bot = MagicMock()
    bot.get_guild.return_value = guild
    app.state.bot = bot

    async with api_client as client:
        response = await client.get("/api/tracking/preview?period=week", cookies=auth_cookies)

    assert response.status_code == 200
    assert set(response.json()) == {"period_start", "period_end", "members", "overlaps", "all_together_seconds"}
    assert response.json()["members"] == [{
        "discord_id": "42", "username": "Ada Renamed", "total_seconds": 0,
        "session_count": 0, "work_seconds": 0,
    }]
    assert response.json()["all_together_seconds"] == 0


@pytest.mark.asyncio
async def test_daily_work_hours_requires_authentication(api_client):
    async with api_client as client:
        response = await client.get("/api/tracking/daily-work-hours")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_daily_work_hours_returns_14_days_by_default(api_client, auth_cookies):
    now = datetime.now(timezone.utc)
    api_client._transport.app.state.pool.tracked_members = {
        42: {
            "discord_id": 42, "username": "Ada", "is_active": True,
            "work_days": [0, 1, 2, 3, 4, 5, 6], "work_start": "00:00:00", "work_end": "23:59:59",
            "timezone": "UTC", "created_at": now, "updated_at": now,
        },
    }

    async with api_client as client:
        response = await client.get("/api/tracking/daily-work-hours", cookies=auth_cookies)

    assert response.status_code == 200
    body = response.json()
    assert body["members"] == [{"discord_id": "42", "username": "Ada"}]
    assert len(body["days"]) == 14
    assert all("date" in day and "42" in day for day in body["days"])


@pytest.mark.asyncio
async def test_daily_work_hours_accepts_custom_days_param(api_client, auth_cookies):
    async with api_client as client:
        response = await client.get("/api/tracking/daily-work-hours?days=7", cookies=auth_cookies)

    assert response.status_code == 200
    assert len(response.json()["days"]) == 7


@pytest.mark.asyncio
async def test_preview_rejects_unknown_period(api_client, auth_cookies):
    async with api_client as client:
        response = await client.get("/api/tracking/preview?period=year", cookies=auth_cookies)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_preview_falls_back_to_stored_name_when_member_is_not_cached(api_client, auth_cookies):
    now = datetime.now(timezone.utc)
    api_client._transport.app.state.pool.tracked_members = {
        42: {
            "discord_id": 42, "username": "Ada", "is_active": True,
            "work_days": [0, 1, 2, 3, 4], "work_start": "09:00:00", "work_end": "18:00:00",
            "timezone": "Europe/Moscow", "created_at": now, "updated_at": now,
        },
    }
    guild = MagicMock()
    guild.get_member.return_value = None
    bot = MagicMock()
    bot.get_guild.return_value = guild
    app.state.bot = bot

    async with api_client as client:
        response = await client.get("/api/tracking/preview?period=week", cookies=auth_cookies)

    assert response.status_code == 200
    assert response.json()["members"][0]["username"] == "Ada"


@pytest.mark.asyncio
@pytest.mark.parametrize("field,value", [("work_start", "09:00:30"), ("work_end", "18:00+03:00")])
async def test_tracking_schedule_rejects_non_hh_mm_times(api_client, auth_cookies, field, value):
    async with api_client as client:
        response = await client.post(
            "/api/tracking/members",
            cookies=auth_cookies,
            json={"discord_id": "42", "username": "Ada", field: value},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_tracking_schedule_patch_rejects_seconds(api_client, auth_cookies):
    async with api_client as client:
        response = await client.patch(
            "/api/tracking/members/42",
            cookies=auth_cookies,
            json={"work_start": "09:00:30"},
        )

    assert response.status_code == 422
