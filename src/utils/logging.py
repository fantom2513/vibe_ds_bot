"""
Настройка structlog: JSON renderer, уровень из конфига (config.yaml logging.level или INFO).
Привязка к стандартному logging по необходимости.
Вызов setup_logging() при старте приложения.
"""

import logging
import sys

import structlog


def setup_logging(
    level: str | None = None,
    config_yaml: dict | None = None,
) -> None:
    """
    Настраивает structlog для приложения.

    - level: явный уровень (DEBUG, INFO, WARNING, ERROR). Если не передан,
      берётся из config_yaml["logging"]["level"], иначе "INFO".
    - config_yaml: структура, возвращённая load_config_yaml() (bot, defaults, channels, logging).
    """
    if level is None and config_yaml:
        logging_config = config_yaml.get("logging") or {}
        level = (logging_config.get("level") or "INFO").upper()
    else:
        level = (level or "INFO").upper()

    numeric_level = getattr(logging, level, logging.INFO)

    # Привязка к стандартному logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=numeric_level,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(numeric_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None):  # noqa: ANN201
    """Возвращает structlog-логгер для модуля (опционально с именем)."""
    return structlog.get_logger(name)
