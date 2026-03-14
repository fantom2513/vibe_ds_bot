"""
MuteXPService: начисление XP за мут, проверка level-up, выдача ролей, embed в лог-канал.
XP начисляется за каждую минуту в "полном муте" (self_mute AND self_deaf).
"""
from datetime import datetime, timezone
from typing import Optional

import discord
import structlog

from src.engine.mute_tracker import MuteSession

log = structlog.get_logger()

MUTE_XP_PER_MINUTE = 10


class MuteXPService:
    def __init__(self, bot, pool, notifier) -> None:
        self.bot = bot
        self.pool = pool
        self.notifier = notifier

    async def record_mute_session(
        self,
        pool,
        member,
        session: MuteSession,
        duration_sec: int,
    ) -> None:
        """Записать завершённую мут-сессию в БД и начислить XP."""
        if duration_sec < 60:
            return  # меньше минуты — не считаем

        xp_earned = (duration_sec // 60) * MUTE_XP_PER_MINUTE

        try:
            await pool.execute(
                """
                INSERT INTO mute_sessions
                    (discord_id, channel_id, started_at, ended_at, duration_sec)
                VALUES ($1, $2, $3, $4, $5)
                """,
                member.id,
                session.channel_id,
                session.started_at,
                datetime.now(timezone.utc),
                duration_sec,
            )
        except Exception as e:
            log.warning("mute_xp.session_insert_failed", error=str(e), discord_id=str(member.id))

        await self._add_xp(pool, member, xp_earned, duration_sec=duration_sec)

    async def _add_xp(
        self,
        pool,
        member,
        xp_earned: int,
        duration_sec: Optional[int] = None,
    ) -> None:
        """Добавить XP и проверить level-up."""
        row = await pool.fetchrow(
            "SELECT xp, level FROM mute_xp WHERE discord_id = $1",
            member.id,
        )
        current_xp = row["xp"] if row else 0
        current_level = row["level"] if row else 0
        new_xp = current_xp + xp_earned

        mute_secs = duration_sec if duration_sec is not None else xp_earned * 6

        await pool.execute(
            """
            INSERT INTO mute_xp (discord_id, xp, total_mute_seconds, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (discord_id) DO UPDATE
            SET xp = mute_xp.xp + $2,
                total_mute_seconds = mute_xp.total_mute_seconds + $3,
                updated_at = NOW()
            """,
            member.id,
            xp_earned,
            mute_secs,
        )

        # Проверить пороги уровней
        levels = await pool.fetch(
            """
            SELECT level, xp_required, role_id, label
            FROM mute_levels
            WHERE xp_required <= $1 AND level > $2
            ORDER BY level ASC
            """,
            new_xp,
            current_level,
        )
        if not levels:
            return

        new_level_row = levels[-1]
        new_level = new_level_row["level"]

        await pool.execute(
            "UPDATE mute_xp SET level = $1 WHERE discord_id = $2",
            new_level,
            member.id,
        )

        # Выдать роль если задана
        guild = self.bot.get_guild(self.bot.guild_id)
        if guild and new_level_row["role_id"]:
            try:
                guild_member = guild.get_member(member.id)
                role = guild.get_role(new_level_row["role_id"])
                if guild_member and role:
                    await guild_member.add_roles(role, reason=f"Mute Level {new_level}")
            except discord.HTTPException as e:
                log.warning("mute_xp.role_assign_failed", error=str(e), discord_id=str(member.id))

        # Уведомление в лог-канал
        notifier = getattr(self, "notifier", None)
        if notifier:
            try:
                await notifier.send(
                    self._build_levelup_embed(member, new_level, new_level_row["label"], new_xp)
                )
            except Exception as e:
                log.warning("mute_xp.notify_failed", error=str(e))

        log.info(
            "mute_xp.level_up",
            discord_id=str(member.id),
            new_level=new_level,
            xp=new_xp,
        )

    def _build_levelup_embed(self, member, level: int, label: str, total_xp: int) -> discord.Embed:
        embed = discord.Embed(
            title="🔇 Новый уровень тишины",
            color=0x8B5CF6,
        )
        embed.add_field(name="Участник", value=f"<@{member.id}>", inline=True)
        embed.add_field(name="Уровень", value=f"**{level}** — {label}", inline=True)
        embed.add_field(name="Всего XP", value=str(total_xp), inline=True)
        embed.set_thumbnail(url=str(member.display_avatar.url))
        embed.timestamp = datetime.now(timezone.utc)
        return embed
