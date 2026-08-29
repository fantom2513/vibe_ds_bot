"""
Тесты интеграции structlog -> алерты: ERROR-уровень логов должен уходить
в мониторинговый webhook (src.utils.alerts.schedule_alert), остальные уровни — нет.
"""
from unittest.mock import MagicMock

import pytest

from src.utils.logging import get_logger, setup_logging


@pytest.fixture(autouse=True)
def _configure_logging():
    """setup_logging() мутирует глобальный structlog.configure — переустанавливаем на тест."""
    setup_logging(level="DEBUG")
    yield


def test_error_level_log_triggers_alert(monkeypatch):
    """log.error(...) должен вызвать schedule_alert с текстом события."""
    mock_schedule = MagicMock()
    monkeypatch.setattr("src.utils.alerts.schedule_alert", mock_schedule)

    log = get_logger("test")
    log.error("something_broke", detail="db timeout")

    mock_schedule.assert_called_once()
    (alert_text,), _ = mock_schedule.call_args
    assert "something_broke" in alert_text


def test_info_level_log_does_not_trigger_alert(monkeypatch):
    """log.info(...) не должен трогать алертинг."""
    mock_schedule = MagicMock()
    monkeypatch.setattr("src.utils.alerts.schedule_alert", mock_schedule)

    log = get_logger("test")
    log.info("routine_event")

    mock_schedule.assert_not_called()


def test_warning_level_log_does_not_trigger_alert(monkeypatch):
    """log.warning(...) не должен трогать алертинг — только error."""
    mock_schedule = MagicMock()
    monkeypatch.setattr("src.utils.alerts.schedule_alert", mock_schedule)

    log = get_logger("test")
    log.warning("degraded_but_not_broken")

    mock_schedule.assert_not_called()
