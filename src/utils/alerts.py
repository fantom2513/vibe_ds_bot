"""
Алерты мониторинга: отправка в отдельный Discord webhook (ALERT_WEBHOOK_URL),
независимый от gateway-сессии бота — долетает, даже если сам бот отвалился
от Discord. Используется из structlog-пайплайна (ERROR-логи) и из
on_disconnect/on_resumed бота.
"""
import asyncio

import httpx

from src.config.settings import get_settings

_HTTP_TIMEOUT = 5.0
_DISCORD_CONTENT_LIMIT = 2000


async def send_alert(content: str) -> None:
    """
    POST текстового сообщения в ALERT_WEBHOOK_URL.
    No-op если вебхук не настроен. Никогда не бросает исключение — алертинг
    не должен ронять вызывающий код.
    """
    settings = get_settings()
    url = settings.ALERT_WEBHOOK_URL
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            await client.post(url, json={"content": content[:_DISCORD_CONTENT_LIMIT]})
    except Exception:
        pass


def schedule_alert(content: str) -> None:
    """
    Fire-and-forget обёртка для вызова из sync-контекста (structlog processor).
    Если активного event loop нет — алерт молча пропускается (не поднимаем
    исключение из логирующего кода).
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(send_alert(content))
