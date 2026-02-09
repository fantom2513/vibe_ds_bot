"""
Детектор стакинга пар: если два пользователя из пары в одном войс-канале — перенос обоих в целевой канал.
Защита от move-loop через _recently_moved.
"""
from __future__ import annotations

from typing import Optional

import discord

from src.utils.logging import get_logger

logger = get_logger("stacking")


class PairRule:
    """Правило пары: user_id_1, user_id_2, target_channel_id."""

    def __init__(self, user_id_1: int, user_id_2: int, target_channel_id: int) -> None:
        self.user_id_1 = user_id_1
        self.user_id_2 = user_id_2
        self.target_channel_id = target_channel_id

    def contains(self, user_id: int) -> bool:
        return user_id in (self.user_id_1, self.user_id_2)

    def partner_of(self, user_id: int) -> Optional[int]:
        if user_id == self.user_id_1:
            return self.user_id_2
        if user_id == self.user_id_2:
            return self.user_id_1
        return None

    def pair_key(self) -> frozenset[int]:
        return frozenset((self.user_id_1, self.user_id_2))


class StackingDetector:
    """
    Проверка пар в голосовых каналах и перенос в целевой канал.
    _recently_moved — защита от повторного переноса, пока кто-то из пары не выйдет из целевого канала.
    """

    def __init__(self) -> None:
        self._pairs: list[PairRule] = []
        self._recently_moved: set[frozenset[int]] = set()

    def load_pairs(self, pairs: list[PairRule]) -> None:
        self._pairs = list(pairs)

    def add_pair(self, pair: PairRule) -> None:
        if pair not in self._pairs:
            self._pairs.append(pair)

    def get_pairs(self) -> list[PairRule]:
        return list(self._pairs)

    async def check_and_move(self, member: discord.Member, guild: discord.Guild) -> bool:
        """
        Вызывается из on_voice_state_update при join/move.
        Если пара в одном канале и не в целевом — переносим обоих в target_channel_id.
        Возвращает True, если перенос выполнен (тогда вызывающий код пропускает обычные правила).
        """
        channel = member.voice and member.voice.channel
        if not channel:
            return False

        for rule in self._pairs:
            if not rule.contains(member.id):
                continue
            partner_id = rule.partner_of(member.id)
            if partner_id is None:
                continue

            partner = guild.get_member(partner_id)
            if not partner or not partner.voice or not partner.voice.channel:
                continue
            if partner.voice.channel.id != channel.id:
                continue

            if channel.id == rule.target_channel_id:
                continue
            pair_key = rule.pair_key()
            if pair_key in self._recently_moved:
                continue

            self._recently_moved.add(pair_key)
            target = guild.get_channel(rule.target_channel_id)
            if not target or not isinstance(target, discord.VoiceChannel):
                logger.warning(
                    "stacking_target_not_voice",
                    target_channel_id=rule.target_channel_id,
                    guild_id=guild.id,
                )
                self._recently_moved.discard(pair_key)
                continue

            moved_any = False
            for m in (member, partner):
                try:
                    await m.move_to(target, reason="pair stacking")
                    moved_any = True
                except Exception as e:
                    logger.warning(
                        "stacking_move_failed",
                        user_id=m.id,
                        target_channel_id=rule.target_channel_id,
                        error=str(e),
                    )
            return moved_any

        return False

    def on_user_leave(self, user_id: int) -> None:
        """Снять блокировку move-loop для пар с этим юзером."""
        to_remove = {pk for pk in self._recently_moved if user_id in pk}
        self._recently_moved -= to_remove
