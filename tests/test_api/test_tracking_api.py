"""Контракт API настройки отслеживаемых участников."""
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
