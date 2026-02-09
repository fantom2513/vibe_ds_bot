"""
Проверка прав бота в гильдии/канале: can_mute, can_move, can_kick.
Используется в engine/actions перед выполнением действий.
"""

from __future__ import annotations

import discord


def can_mute(member: discord.Member, guild: discord.Guild) -> bool:
    """
    Проверяет, может ли бот заглушить пользователя (mute) в голосовом канале.
    Требуется право MUTE_MEMBERS у бота в гильдии.
    """
    me = guild.me
    if me is None:
        return False
    return me.guild_permissions.mute_members


def can_move(member: discord.Member, guild: discord.Guild) -> bool:
    """
    Проверяет, может ли бот переместить пользователя в другой голосовой канал.
    Требуется право MOVE_MEMBERS у бота в гильдии.
    """
    me = guild.me
    if me is None:
        return False
    return me.guild_permissions.move_members


def can_kick(member: discord.Member, guild: discord.Guild) -> bool:
    """
    Проверяет, может ли бот отключить пользователя от голосового канала (move_to(None)).
    В Discord для отключения от войса используется право MOVE_MEMBERS.
    """
    me = guild.me
    if me is None:
        return False
    return me.guild_permissions.move_members
