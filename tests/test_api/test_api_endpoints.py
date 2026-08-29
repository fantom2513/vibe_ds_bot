"""Тесты API с JWT cookie-аутентификацией."""
import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt

from src.api.app import app
from src.config.settings import get_settings


@pytest.fixture
def api_client(pool):
    """Клиент с подставленным тестовым пулом в app.state."""
    app.state.pool = pool
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def auth_cookies():
    """Валидная cookie, соответствующая текущей OAuth2/JWT-аутентификации API."""
    settings = get_settings()
    token = jwt.encode(
        {"sub": "123", "username": "TestAdmin"},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    return {"access_token": token}


@pytest.mark.asyncio
async def test_get_rules_without_auth_cookie_returns_401(api_client):
    """Без JWT cookie запрос к /api/rules возвращает 401."""
    async with api_client as client:
        response = await client.get("/api/rules")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_rules_with_auth_cookie_returns_200_and_list(api_client, auth_cookies):
    """С валидной JWT cookie GET /api/rules возвращает список."""
    async with api_client as client:
        response = await client.get(
            "/api/rules",
            cookies=auth_cookies,
        )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_post_users_without_auth_cookie_returns_401(api_client):
    """Без JWT cookie POST /api/users возвращает 401."""
    async with api_client as client:
        response = await client.post(
            "/api/users",
            json={"discord_id": 111, "list_type": "blacklist"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_post_users_with_auth_cookie_returns_200_and_body(api_client, auth_cookies):
    """С JWT cookie POST /api/users возвращает созданную запись."""
    async with api_client as client:
        response = await client.post(
            "/api/users",
            cookies=auth_cookies,
            json={
                "discord_id": 222,
                "list_type": "blacklist",
                "username": "Test",
                "reason": None,
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["discord_id"] == "222"
    assert data["list_type"] == "blacklist"
    assert "id" in data
    assert "created_at" in data
