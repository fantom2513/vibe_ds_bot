"""
Вспомогательные функции для создания Discord Embed-сообщений уведомлений.
"""
from datetime import datetime, timezone
from typing import Any, Optional

import discord

_ACTION_COLORS = {
    "mute": discord.Color.orange(),
    "unmute": discord.Color.green(),
    "move": discord.Color.blue(),
    "kick": discord.Color.red(),
}

_ACTION_ICONS = {
    "mute": "\U0001f507",    # 🔇
    "unmute": "\U0001f50a",  # 🔊
    "move": "\U0001f500",    # 🔀
    "kick": "\U0001f462",    # 👢
}


def _now_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def build_rule_action_embed(
    member: discord.Member,
    action_type: str,
    channel: Optional[discord.VoiceChannel],
    rule_id: Optional[int],
    is_dry_run: bool = False,
) -> discord.Embed:
    """Embed для события правила (mute/move/kick/unmute)."""
    icon = _ACTION_ICONS.get(action_type, "\u26a1")
    color = discord.Color.light_grey() if is_dry_run else _ACTION_COLORS.get(action_type, discord.Color.greyple())
    dry_label = " [DRY RUN]" if is_dry_run else ""
    title = f"{icon} {action_type.capitalize()}{dry_label}"

    embed = discord.Embed(title=title, color=color)
    embed.add_field(name="User", value=f"{member.mention} ({member.id})", inline=True)
    embed.add_field(name="Channel", value=channel.mention if channel else "unknown", inline=True)
    rule_label = f"#{rule_id}" if rule_id is not None else "—"
    embed.add_field(name="Rule", value=f"{rule_label} — {action_type}{dry_label}", inline=False)
    embed.set_footer(text=_now_ts())
    return embed


def build_pair_move_embed(
    member1: discord.Member,
    member2: discord.Member,
    from_channel: Optional[discord.VoiceChannel],
    to_channel: Optional[discord.VoiceChannel],
) -> discord.Embed:
    """Embed для события pair stacking move."""
    embed = discord.Embed(title="\U0001f500 Pair Move", color=discord.Color.purple())
    embed.add_field(name="Users", value=f"{member1.mention} + {member2.mention}", inline=False)
    embed.add_field(name="From", value=from_channel.mention if from_channel else "unknown", inline=True)
    embed.add_field(name="To", value=to_channel.mention if to_channel else "unknown", inline=True)
    embed.set_footer(text=_now_ts())
    return embed


def build_kick_timeout_embed(
    member: discord.Member,
    channel: Optional[discord.VoiceChannel],
    elapsed_sec: float,
) -> discord.Embed:
    """Embed для события kick timeout disconnect."""
    minutes = int(elapsed_sec // 60)
    seconds = int(elapsed_sec % 60)
    embed = discord.Embed(title="\u23f1\ufe0f Timeout Disconnect", color=discord.Color.red())
    embed.add_field(name="User", value=f"{member.mention} ({member.id})", inline=True)
    embed.add_field(name="Channel", value=channel.mention if channel else "unknown", inline=True)
    embed.add_field(name="After", value=f"{minutes}m {seconds}s", inline=True)
    embed.set_footer(text=_now_ts())
    return embed


def build_weekly_report_embed(stats: dict[str, Any]) -> discord.Embed:
    """Embed для еженедельного отчёта."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    week_start = (now - timedelta(days=7)).strftime("%d.%m")
    week_end = now.strftime("%d.%m")

    total_sec = int(stats.get("total_seconds") or 0)
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60

    embed = discord.Embed(
        title=f"\U0001f4ca Weekly Report \u2014 {week_start} \u2013 {week_end}",
        color=discord.Color(0x5865F2),
    )
    embed.add_field(name="Total sessions", value=str(stats.get("total_sessions", 0)), inline=True)
    embed.add_field(name="Total voice time", value=f"{hours}h {minutes}m", inline=True)
    embed.add_field(name="Actions executed", value=str(stats.get("total_actions", 0)), inline=True)

    top_user_id = stats.get("top_user_id")
    if top_user_id:
        embed.add_field(name="Most active user", value=f"<@{top_user_id}>", inline=True)

    embed.set_footer(text="Next report in 7 days")
    return embed
