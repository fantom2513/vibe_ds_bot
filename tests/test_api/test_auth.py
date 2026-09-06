"""Behavioral tests for Discord OAuth session persistence."""

from http.cookies import SimpleCookie

import pytest

from src.api.routers import auth
from src.config.settings import Settings


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.status_code = 200
        self._payload = payload

    def json(self) -> dict:
        return self._payload


class _FakeDiscordClient:
    async def __aenter__(self) -> "_FakeDiscordClient":
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def post(self, *_args: object, **_kwargs: object) -> _FakeResponse:
        return _FakeResponse({"access_token": "discord-access-token"})

    async def get(self, *_args: object, **_kwargs: object) -> _FakeResponse:
        return _FakeResponse({"id": "42", "username": "Admin", "avatar": None})


@pytest.mark.asyncio
async def test_discord_login_persists_for_thirty_days(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        _env_file=None,
        DISCORD_TOKEN="bot-token",
        DISCORD_GUILD_ID=1,
        DATABASE_URL="postgresql+asyncpg://bot:password@localhost:5432/bot",
        API_SECRET_KEY="api-secret",
        DISCORD_CLIENT_ID="client-id",
        DISCORD_CLIENT_SECRET="client-secret",
        DISCORD_REDIRECT_URI="https://vibe.example/auth/discord/callback",
        JWT_SECRET="jwt-secret",
        ALLOWED_DISCORD_IDS=[42],
    )
    monkeypatch.setattr(auth, "get_settings", lambda: settings)
    monkeypatch.setattr(auth.httpx, "AsyncClient", _FakeDiscordClient)

    response = await auth.discord_callback("oauth-code")

    cookies = SimpleCookie()
    cookies.load(response.headers["set-cookie"])
    assert cookies["access_token"]["max-age"] == str(30 * 24 * 60 * 60)
