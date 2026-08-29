"""Тесты /api/health: статус бота (Discord gateway) и БД для внешнего мониторинга."""
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from src.api.app import app


@pytest.fixture
def health_client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_without_bot_or_pool_returns_false_flags(health_client):
    """Ни бот, ни пул не установлены в app.state — статус ok, флаги false."""
    app.state.bot = None
    app.state.pool = None
    async with health_client as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["discord_connected"] is False
    assert data["db_connected"] is False


@pytest.mark.asyncio
async def test_health_with_ready_bot_and_working_pool_returns_true_flags(health_client, pool):
    """Бот готов (is_ready=True) и пул отвечает на запрос — оба флага true."""
    bot = MagicMock()
    bot.is_ready.return_value = True
    app.state.bot = bot
    app.state.pool = pool
    async with health_client as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["discord_connected"] is True
    assert data["db_connected"] is True


@pytest.mark.asyncio
async def test_health_with_disconnected_bot_returns_discord_connected_false(health_client, pool):
    """Бот не готов (is_ready=False) — discord_connected false, но остальное не падает."""
    bot = MagicMock()
    bot.is_ready.return_value = False
    app.state.bot = bot
    app.state.pool = pool
    async with health_client as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["discord_connected"] is False


@pytest.mark.asyncio
async def test_health_with_failing_pool_returns_db_connected_false(health_client):
    """Пул падает при запросе — эндпоинт не 500, db_connected false."""
    class BrokenPool:
        def acquire(self):
            raise ConnectionError("db unreachable")

    app.state.bot = None
    app.state.pool = BrokenPool()
    async with health_client as client:
        response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["db_connected"] is False
