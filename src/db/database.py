"""
Подключение к PostgreSQL через asyncpg. Пул соединений, context manager и LISTEN/NOTIFY.
"""
import asyncio
import os
from collections.abc import Callable
from contextlib import asynccontextmanager
from typing import Optional

import asyncpg

# Чтение только из окружения, чтобы не создавать циклические зависимости с config
DATABASE_URL_ENV_KEY = "DATABASE_URL"
CONFIG_CHANGED_CHANNEL = "config_changed"

_pool: Optional[asyncpg.Pool] = None
_config_listeners: list[Callable[[], None]] = []
_listen_task: Optional[asyncio.Task[None]] = None
_listen_stop = asyncio.Event()


def _get_database_url() -> str:
    url = os.environ.get(DATABASE_URL_ENV_KEY)
    if not url:
        raise RuntimeError(
            f"Переменная окружения {DATABASE_URL_ENV_KEY} не задана. "
            "Укажите DATABASE_URL (например postgresql://user:pass@host:5432/dbname)."
        )
    # asyncpg ожидает postgresql://, а не postgresql+asyncpg://
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return url


def get_pool() -> asyncpg.Pool:
    """Возвращает глобальный пул подключений. Перед вызовом должен быть вызван init_pool()."""
    if _pool is None:
        raise RuntimeError("Пул БД не инициализирован. Вызовите init_pool() при старте приложения.")
    return _pool


async def init_pool(
    min_size: int = 2,
    max_size: int = 10,
    command_timeout: float = 60.0,
) -> asyncpg.Pool:
    """Создаёт глобальный пул asyncpg и возвращает его."""
    global _pool
    if _pool is not None:
        return _pool
    url = _get_database_url()
    _pool = await asyncpg.create_pool(
        url,
        min_size=min_size,
        max_size=max_size,
        command_timeout=command_timeout,
    )
    return _pool


async def close_pool() -> None:
    """Закрывает глобальный пул подключений и останавливает задачу LISTEN."""
    global _listen_task
    _listen_stop.set()
    if _listen_task is not None:
        _listen_task.cancel()
        try:
            await _listen_task
        except asyncio.CancelledError:
            pass
        _listen_task = None
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def register_config_listener(callback: Callable[[], None]) -> None:
    """
    Регистрирует callback для вызова при получении NOTIFY config_changed.
    При первой регистрации запускается фоновая задача LISTEN (нужен уже инициализированный пул).
    """
    _config_listeners.append(callback)


def _invoke_config_listeners() -> None:
    """Вызывает все зарегистрированные callback'и при получении NOTIFY."""
    for cb in _config_listeners:
        try:
            cb()
        except Exception:
            pass  # не ломаем остальных слушателей


async def _listen_task_fn() -> None:
    """
    Держит отдельное соединение из пула, подписывается на config_changed,
    при получении NOTIFY вызывает зарегистрированные callback'и.
    """
    pool = get_pool()
    conn = await pool.acquire()
    try:
        def _on_notify(
            _connection: asyncpg.Connection,
            _pid: int,
            _channel: str,
            _payload: str,
        ) -> None:
            _invoke_config_listeners()

        await conn.add_listener(CONFIG_CHANGED_CHANNEL, _on_notify)
        await _listen_stop.wait()
    except asyncio.CancelledError:
        pass
    finally:
        await pool.release(conn)


def start_config_listener() -> None:
    """
    Запускает фоновую задачу LISTEN config_changed (если есть подписчики).
    Вызывать после init_pool(). Пул должен быть инициализирован.
    """
    global _listen_task
    if not _config_listeners or _listen_task is not None:
        return
    _listen_stop.clear()
    _listen_task = asyncio.create_task(_listen_task_fn())


async def notify_config_changed(pool: asyncpg.Pool) -> None:
    """
    Отправляет NOTIFY config_changed (для вызова из API после изменения правил/пользователей/расписаний).
    """
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_notify($1, $2)", CONFIG_CHANGED_CHANNEL, "")


@asynccontextmanager
async def get_connection():
    """Асинхронный context manager для получения соединения из пула."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
