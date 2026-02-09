"""
Фикстуры pytest: event_loop, тестовый пул БД (мок), моки Discord (Member, Guild), настройки.
"""
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock

import pytest


# --- Mock Pool (in-memory для тестов без PostgreSQL) ---


class MockConn:
    """Мок соединения: execute делегируется пулу (для pg_notify и т.д.)."""

    def __init__(self, pool: "MockPool") -> None:
        self._pool = pool

    async def execute(self, query: str, *args: Any) -> str:
        return await self._pool.execute(query, *args)

    async def fetch(self, query: str, *args: Any) -> list:
        return await self._pool.fetch(query, *args)

    async def fetchrow(self, query: str, *args: Any) -> dict | None:
        return await self._pool.fetchrow(query, *args)


class MockPool:
    """
    Мок asyncpg.Pool с in-memory хранилищем для voice_sessions, rules, user_lists.
    Поддерживает execute, fetch, fetchrow, acquire для трекера и API-тестов.
    """

    def __init__(self) -> None:
        self.voice_sessions: list[dict[str, Any]] = []
        self.rules: list[dict[str, Any]] = []
        self._rules_id = 0
        self.user_lists: list[dict[str, Any]] = []
        self._user_lists_id = 0

    async def execute(self, query: str, *args: Any) -> str:
        q = query.strip().upper()
        if "INSERT INTO VOICE_SESSIONS" in q:
            # INSERT INTO voice_sessions (discord_id, channel_id, joined_at, left_at) VALUES ($1, $2, $3, NULL)
            self.voice_sessions.append({
                "discord_id": args[0],
                "channel_id": args[1],
                "joined_at": args[2],
                "left_at": None,
            })
            return "INSERT 1"
        if "UPDATE VOICE_SESSIONS" in q and "LEFT_AT" in q:
            # UPDATE ... SET left_at = NOW() WHERE discord_id = $1 AND channel_id = $2
            for row in self.voice_sessions:
                if row["left_at"] is None and row["discord_id"] == args[0] and row["channel_id"] == args[1]:
                    row["left_at"] = datetime.now(timezone.utc)
                    return "UPDATE 1"
            return "UPDATE 0"
        if "SELECT PG_NOTIFY" in q:
            return "SELECT"
        if "INSERT INTO RULES" in q:
            # Обрабатывается в fetchrow с RETURNING
            return "INSERT 1"
        if "INSERT INTO USER_LISTS" in q:
            return "INSERT 1"
        if "DELETE FROM" in q:
            return "DELETE 1"
        if "UPDATE RULES" in q:
            return "UPDATE 1"
        return "OK"

    async def fetch(self, query: str, *args: Any) -> list[dict]:
        q = query.strip().upper()
        if "FROM RULES" in q and "SELECT" in q:
            return list(self.rules)
        if "FROM USER_LISTS" in q and "SELECT" in q:
            list_type = args[0] if args else None
            if list_type:
                return [r for r in self.user_lists if r["list_type"] == list_type]
            return list(self.user_lists)
        return []

    async def fetchrow(self, query: str, *args: Any) -> dict | None:
        q = query.strip().upper()
        if "INSERT INTO RULES" in q and "RETURNING" in q:
            self._rules_id += 1
            now = datetime.now(timezone.utc)
            row = {
                "id": self._rules_id,
                "name": args[0] if len(args) > 0 else "",
                "description": args[1] if len(args) > 1 else None,
                "is_active": args[2] if len(args) > 2 else True,
                "target_list": args[3] if len(args) > 3 else None,
                "channel_ids": args[4] if len(args) > 4 else None,
                "max_time_sec": args[5] if len(args) > 5 else None,
                "action_type": args[6] if len(args) > 6 else "",
                "action_params": args[7] if len(args) > 7 else {},
                "schedule_cron": args[8] if len(args) > 8 else None,
                "schedule_tz": args[9] if len(args) > 9 else "UTC",
                "priority": args[10] if len(args) > 10 else 0,
                "created_at": args[11] if len(args) > 11 else now,
                "updated_at": args[12] if len(args) > 12 else now,
            }
            self.rules.append(row)
            return row
        if "INSERT INTO USER_LISTS" in q and "RETURNING" in q:
            self._user_lists_id += 1
            now = datetime.now(timezone.utc)
            row = {
                "id": self._user_lists_id,
                "discord_id": args[0],
                "username": args[1] if len(args) > 1 else None,
                "list_type": args[2],
                "reason": args[3] if len(args) > 3 else None,
                "created_at": args[4] if len(args) > 4 else now,
                "updated_at": args[5] if len(args) > 5 else now,
            }
            self.user_lists.append(row)
            return row
        if "FROM RULES" in q and "WHERE ID" in q:
            rid = args[0] if args else None
            for r in self.rules:
                if r["id"] == rid:
                    return r
            return None
        if "SELECT 1 FROM USER_LISTS" in q:
            discord_id, list_type = args[0], args[1]
            for r in self.user_lists:
                if r["discord_id"] == discord_id and r["list_type"] == list_type:
                    return {"1": 1}
            return None
        return None

    @asynccontextmanager
    async def acquire(self):
        yield MockConn(self)


# --- Фикстуры ---


@pytest.fixture
def event_loop():
    """Фикстура event_loop для pytest-asyncio."""
    import asyncio
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def pool() -> AsyncGenerator[MockPool, None]:
    """Тестовый пул БД (мок in-memory). Каждый тест получает новый пул."""
    p = MockPool()
    yield p


@pytest.fixture
def mock_guild():
    """Мок discord.Guild: id, owner_id, get_channel, get_member, me с правами."""
    guild = MagicMock()
    guild.id = 999888777
    guild.owner_id = 111222333
    guild.get_channel = MagicMock(return_value=None)
    guild.get_member = MagicMock(return_value=None)
    me = MagicMock()
    me.guild_permissions = MagicMock()
    me.guild_permissions.mute_members = True
    me.guild_permissions.move_members = True
    guild.me = me
    return guild


@pytest.fixture
def mock_member(mock_guild):
    """Мок discord.Member: id, guild, voice (channel), display_name."""
    member = MagicMock()
    member.id = 123456789
    member.guild = mock_guild
    member.display_name = "TestUser"
    member.voice = MagicMock()
    member.voice.channel = None
    return member


@pytest.fixture
def mock_discord(mock_member, mock_guild):
    """Пара (member, guild) для тестов."""
    return {"member": mock_member, "guild": mock_guild}


@pytest.fixture(autouse=True)
def patch_settings(monkeypatch):
    """Тестовые переменные окружения для Settings (API_SECRET_KEY и др.)."""
    monkeypatch.setenv("DISCORD_TOKEN", "test-token")
    monkeypatch.setenv("DISCORD_GUILD_ID", "123")
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/test")
    monkeypatch.setenv("API_SECRET_KEY", "test-api-key")
    # Сброс кэша настроек, чтобы get_settings() подхватил env
    import src.config.settings as _settings_mod
    monkeypatch.setattr(_settings_mod, "_settings", None)


@pytest.fixture
def clear_tracker_sessions():
    """Очистить in-memory сессии трекера для изоляции тестов."""
    from src.engine import tracker as tracker_mod
    tracker_mod._sessions.clear()
    yield
    tracker_mod._sessions.clear()
