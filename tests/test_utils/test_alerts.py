"""
Тесты src.utils.alerts.send_alert — отправка алертов в отдельный Discord webhook,
независимый от gateway-сессии бота (для мониторинга).
"""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.utils.alerts import schedule_alert, send_alert


@pytest.mark.asyncio
async def test_send_alert_does_nothing_when_webhook_not_configured(monkeypatch):
    """ALERT_WEBHOOK_URL пуст (по умолчанию) — HTTP-запрос не делается."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "")
    import src.config.settings as settings_mod
    monkeypatch.setattr(settings_mod, "_settings", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_alert("test message")

    mock_post.assert_not_called()


@pytest.mark.asyncio
async def test_send_alert_posts_content_to_configured_webhook(monkeypatch):
    """При настроенном ALERT_WEBHOOK_URL шлётся POST с полем content."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/test")
    import src.config.settings as settings_mod
    monkeypatch.setattr(settings_mod, "_settings", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_alert("bot disconnected")

    mock_post.assert_awaited_once()
    args, kwargs = mock_post.call_args
    assert args[0] == "https://discord.com/api/webhooks/test"
    assert kwargs["json"]["content"] == "bot disconnected"


@pytest.mark.asyncio
async def test_send_alert_never_raises_when_webhook_request_fails(monkeypatch):
    """Сбой самого вебхука (сеть, 4xx/5xx) не должен ронять вызывающий код."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/test")
    import src.config.settings as settings_mod
    monkeypatch.setattr(settings_mod, "_settings", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = ConnectionError("network unreachable")
        await send_alert("this should not raise")  # не должно бросить исключение


@pytest.mark.asyncio
async def test_send_alert_truncates_content_to_2000_chars(monkeypatch):
    """Discord отклоняет content длиннее 2000 символов — обрезаем на стороне отправителя."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/test")
    import src.config.settings as settings_mod
    monkeypatch.setattr(settings_mod, "_settings", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_alert("x" * 3000)

    sent_content = mock_post.call_args.kwargs["json"]["content"]
    assert len(sent_content) == 2000


def test_schedule_alert_does_not_raise_without_running_event_loop():
    """Вызов из чисто синхронного контекста (нет активного event loop) — не должен падать."""
    schedule_alert("no loop running")  # не должно бросить исключение


@pytest.mark.asyncio
async def test_schedule_alert_fires_send_alert_as_background_task(monkeypatch):
    """Внутри работающего event loop schedule_alert должен запланировать send_alert."""
    monkeypatch.setenv("ALERT_WEBHOOK_URL", "https://discord.com/api/webhooks/test")
    import src.config.settings as settings_mod
    monkeypatch.setattr(settings_mod, "_settings", None)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        schedule_alert("bot_disconnected")
        await asyncio.sleep(0)  # дать шанс запланированной задаче выполниться

    mock_post.assert_awaited_once()
    assert mock_post.call_args.kwargs["json"]["content"] == "bot_disconnected"
