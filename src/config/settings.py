"""
Настройки приложения: переменные окружения (.env) и опциональная загрузка config.yaml.
Без импортов из db, bot, engine, api — только pydantic-settings и PyYAML.
"""

from pathlib import Path
from typing import Any

import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# --- Структура по умолчанию для config.yaml (секции bot, defaults, channels, logging) ---

_DEFAULT_YAML = {
    "bot": {"command_prefix": "!", "status": "online"},
    "defaults": {
        "max_channel_time_sec": 3600,
        "mute_on_blacklist_join": False,
        "kick_on_blacklist_join": False,
    },
    "channels": {"monitored": [], "move_target": None},
    "logging": {"level": "INFO", "format": "json"},
    "pair_stacking": {
        "enabled": True,
        "target_channel_id": None,
        "pairs": [],
    },
    "kick_timeout": {
        "enabled": True,
        "default_timeout_sec": 3600,
        "targets": [],
    },
}


def load_config_yaml(path: str | Path | None = None) -> dict[str, Any]:
    """
    Загружает config.yaml и возвращает структуру с секциями bot, defaults, channels, logging.
    Если файл отсутствует или секция не задана — подставляются значения по умолчанию.

    Остальной код может читать: command_prefix, status, max_channel_time_sec,
    monitored, move_target, level, format.
    """
    if path is None:
        path = Path("config.yaml")
    path = Path(path)
    if not path.is_file():
        return _DEFAULT_YAML.copy()

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    def merge(base: dict, override: dict) -> dict:
        out = dict(base)
        for k, v in override.items():
            if k in out and isinstance(out[k], dict) and isinstance(v, dict):
                out[k] = merge(out[k], v)
            else:
                out[k] = v
        return out

    return merge(_DEFAULT_YAML, data)


class Settings(BaseSettings):
    """Настройки из .env (pydantic-settings)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DISCORD_TOKEN: str = Field(..., description="Токен Discord-бота")
    DISCORD_GUILD_ID: int = Field(..., description="ID гильдии")
    DATABASE_URL: str = Field(..., description="URL БД (postgresql+asyncpg://...)")
    API_HOST: str = Field(default="0.0.0.0", description="Хост API")
    API_PORT: int = Field(default=8000, description="Порт API")
    API_SECRET_KEY: str = Field(..., description="Секрет для JWT/API")
    SCHEDULER_CHECK_INTERVAL: int = Field(default=30, description="Интервал проверки overtime (сек)")
    DEFAULT_TIMEZONE: str = Field(default="Europe/Moscow", description="Часовой пояс по умолчанию")
    RATE_LIMIT_ACTIONS_PER_MINUTE: int = Field(
        default=60,
        description="Макс. действий (mute/kick/move) в минуту на гильдию; 0 — без лимита",
    )


_settings: Settings | None = None


def get_stacking_pairs(config: dict) -> list[dict]:
    """
    Из config["pair_stacking"]["pairs"] извлечь список:
    [{"user_id_1": int, "user_id_2": int, "target_channel_id": int}]

    Формат в YAML:
      pairs:
        - [uid1, uid2]                    # использует pair_stacking.target_channel_id
        - [uid1, uid2, custom_target_id]  # свой target
    """
    section = config.get("pair_stacking") or {}
    default_target = section.get("target_channel_id")
    pairs_raw = section.get("pairs") or []
    result: list[dict] = []
    for item in pairs_raw:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        uid1, uid2 = int(item[0]), int(item[1])
        if len(item) >= 3:
            target_channel_id = int(item[2])
        else:
            target_channel_id = default_target
        if target_channel_id is None:
            continue
        result.append({
            "user_id_1": uid1,
            "user_id_2": uid2,
            "target_channel_id": target_channel_id,
        })
    return result


def get_kick_timeout_targets(config: dict) -> list[dict]:
    """
    Из config["kick_timeout"]["targets"] извлечь:
    [{"discord_id": int, "timeout_sec": int}]
    """
    section = config.get("kick_timeout") or {}
    default_sec = section.get("default_timeout_sec", 3600)
    targets_raw = section.get("targets") or []
    result: list[dict] = []
    for item in targets_raw:
        if isinstance(item, dict):
            discord_id = item.get("discord_id")
            timeout_sec = item.get("timeout_sec", default_sec)
        elif isinstance(item, (list, tuple)) and len(item) >= 1:
            discord_id = int(item[0])
            timeout_sec = int(item[1]) if len(item) >= 2 else default_sec
        else:
            continue
        if discord_id is None:
            continue
        result.append({"discord_id": int(discord_id), "timeout_sec": int(timeout_sec)})
    return result


def get_settings() -> Settings:
    """Возвращает единственный экземпляр настроек (singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
