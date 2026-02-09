"""
Rate limiting для действий бота: N действий в минуту на гильдию.
Скользящее окно по времени (in-memory).
"""
import time
from collections import defaultdict
from collections.abc import MutableMapping

# guild_id -> список timestamp последних действий (скользящее окно 60 сек)
_actions_by_guild: MutableMapping[int, list[float]] = defaultdict(list)
_WINDOW_SEC = 60.0


def _clean_old(ts_list: list[float]) -> None:
    now = time.monotonic()
    cutoff = now - _WINDOW_SEC
    while ts_list and ts_list[0] < cutoff:
        ts_list.pop(0)


def check_action_allowed(guild_id: int, max_per_minute: int) -> bool:
    """
    Проверить, можно ли выполнить ещё одно действие в гильдии.
    max_per_minute — лимит из настроек (например 60).
    """
    if max_per_minute <= 0:
        return True
    lst = _actions_by_guild[guild_id]
    _clean_old(lst)
    return len(lst) < max_per_minute


def record_action(guild_id: int) -> None:
    """Записать выполненное действие для учёта rate limit."""
    _actions_by_guild[guild_id].append(time.monotonic())
