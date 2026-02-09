"""
Тесты API: GET /api/rules, POST /api/users с X-API-Key; без ключа — 401.
Проверка кодов ответов и структуры JSON.
"""
import pytest
from httpx import ASGITransport, AsyncClient

from src.api.app import app


@pytest.fixture
def api_client(pool):
    """Клиент с подставленным тестовым пулом в app.state."""
    app.state.pool = pool
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_get_rules_without_api_key_returns_401(api_client):
    """Без заголовка X-API-Key запрос к /api/rules возвращает 401."""
    async with api_client as client:
        response = await client.get("/api/rules")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_rules_with_api_key_returns_200_and_list(api_client):
    """С заголовком X-API-Key GET /api/rules возвращает 200 и список (JSON)."""
    async with api_client as client:
        response = await client.get(
            "/api/rules",
            headers={"X-API-Key": "test-api-key"},
        )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_post_users_without_api_key_returns_401(api_client):
    """Без X-API-Key POST /api/users возвращает 401."""
    async with api_client as client:
        response = await client.post(
            "/api/users",
            json={"discord_id": 111, "list_type": "blacklist"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_post_users_with_api_key_returns_200_and_body(api_client):
    """С X-API-Key POST /api/users возвращает 200 и тело с записью пользователя."""
    async with api_client as client:
        response = await client.post(
            "/api/users",
            headers={"X-API-Key": "test-api-key"},
            json={
                "discord_id": 222,
                "list_type": "blacklist",
                "username": "Test",
                "reason": None,
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["discord_id"] == 222
    assert data["list_type"] == "blacklist"
    assert "id" in data
    assert "created_at" in data
