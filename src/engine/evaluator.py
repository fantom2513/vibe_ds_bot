"""
Оценщик правил: по участнику, каналу и правилам возвращает список действий для немедленного выполнения.
Правила только с max_time_sec (таймер) не дают действия здесь — ими занимается scheduler.
"""
from dataclasses import dataclass
from typing import Any, List

import asyncpg
import discord

from src.engine.rules import Rule


@dataclass
class ActionToRun:
    """Действие к выполнению: тип, параметры, id правила."""
    action_type: str
    params: dict[str, Any]
    rule_id: int


async def evaluate(
    member: discord.Member,
    channel: discord.VoiceChannel,
    rules: List[Rule],
    users_repo: Any,
    pool: asyncpg.Pool,
) -> List[ActionToRun]:
    """
    Оценить правила для участника, вошедшего в канал. Возвращает список действий
    для немедленного выполнения (по target_list: whitelist/blacklist).
    Правила с max_time_sec без целевого списка не добавляют действий здесь.
    """
    result: List[ActionToRun] = []
    for rule in rules:
        # Только правило с целевым списком даёт немедленное действие при входе
        target_list = rule.target_list
        if not target_list or not rule.action_type:
            continue

        if target_list == "blacklist":
            in_list = await users_repo.is_in_list(pool, member.id, "blacklist")
            if not in_list:
                continue
        elif target_list == "whitelist":
            in_list = await users_repo.is_in_list(pool, member.id, "whitelist")
            if in_list:
                continue  # в whitelist — разрешён, действие не применяем
        else:
            continue

        result.append(
            ActionToRun(
                action_type=rule.action_type,
                params=dict(rule.action_params),
                rule_id=rule.id,
            )
        )
    return result
