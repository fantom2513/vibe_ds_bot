"""
SSE fan-out broadcaster: один синглтон, несколько подписчиков.
"""
import asyncio

import structlog

log = structlog.get_logger()


class SSEBroadcaster:
    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers.append(q)
        log.info("sse.subscribe", total=len(self._subscribers))
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._subscribers.remove(q)
            log.info("sse.unsubscribe", total=len(self._subscribers))
        except ValueError:
            pass

    async def broadcast(self, event: dict) -> None:
        dead: list[asyncio.Queue] = []
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.unsubscribe(q)


broadcaster = SSEBroadcaster()
