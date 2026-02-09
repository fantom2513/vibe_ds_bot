"""
Модели правил в коде (engine). Rule и преобразование из строк БД в list[Rule].
"""
from dataclasses import dataclass
from typing import Any, List, Optional


@dataclass
class Rule:
    """Правило: id, целевой список (whitelist/blacklist), каналы, лимит времени, действие, приоритет."""
    id: int
    name: str
    is_active: bool
    target_list: Optional[str]  # 'whitelist' | 'blacklist'
    channel_ids: Optional[List[int]]
    max_time_sec: Optional[int]
    action_type: str
    action_params: dict[str, Any]
    priority: int

    @classmethod
    def from_dict(cls, row: dict[str, Any]) -> "Rule":
        """Создать Rule из словаря (строка БД)."""
        channel_ids = row.get("channel_ids")
        if channel_ids is not None and not isinstance(channel_ids, list):
            channel_ids = list(channel_ids) if channel_ids else None
        return cls(
            id=row["id"],
            name=row.get("name", ""),
            is_active=row.get("is_active", True),
            target_list=row.get("target_list"),
            channel_ids=channel_ids,
            max_time_sec=row.get("max_time_sec"),
            action_type=row.get("action_type", ""),
            action_params=row.get("action_params") or {},
            priority=row.get("priority", 0),
        )


def rules_from_dicts(rows: list[dict[str, Any]]) -> list[Rule]:
    """Преобразовать список строк БД в list[Rule]."""
    return [Rule.from_dict(r) for r in rows]
