"""
Cog: slash-команды для администраторов.
Группы: /rule, /user, /stats.
Все ответы ephemeral=True — видны только вызвавшему администратору.
Доступ контролируется через default_member_permissions(administrator=True).
"""
import discord
from datetime import datetime, time, timedelta, timezone
from discord import app_commands
from discord.ext import commands
from typing import Literal
from zoneinfo import ZoneInfo

from src.db.repositories import rules_repo, stats_repo, tracking_repo, users_repo
from src.engine.tracking_report import (
    MemberSchedule,
    calculate_member_totals,
    calculate_pair_overlaps,
)
from src.utils.logging import get_logger

logger = get_logger("admin_commands")

MAX_EMBED_FIELDS = 25
MAX_MEMBER_FIELDS = 23
MAX_FIELD_NAME_LENGTH = 100
MAX_FIELD_VALUE_LENGTH = 1024


def _fmt_seconds(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    if h:
        return f"{h}h {m}m"
    return f"{m}m"


def _tracking_period_bounds(period: str, now: datetime) -> tuple[datetime, datetime]:
    msk = ZoneInfo("Europe/Moscow")
    local_now = now.astimezone(msk)
    if period == "today":
        start = local_now.date()
    elif period == "week":
        start = local_now.date() - timedelta(days=local_now.weekday())
    else:
        start = local_now.date().replace(day=1)
    return datetime.combine(start, time.min, msk).astimezone(timezone.utc), now


def _as_time(value: str | time) -> time:
    return value if isinstance(value, time) else time.fromisoformat(value)


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else f"{value[:limit - 1]}…"


def _summarize_stacks(lines: list[str]) -> str:
    if not lines:
        return "Нет пересечений"
    shown: list[str] = []
    for index, line in enumerate(lines):
        remaining = len(lines) - index - 1
        suffix = f"\n… и ещё {remaining}" if remaining else ""
        candidate = "\n".join([*shown, line]) + suffix
        if len(candidate) > MAX_FIELD_VALUE_LENGTH:
            break
        shown.append(line)
    hidden = len(lines) - len(shown)
    suffix = f"\n… и ещё {hidden}" if hidden else ""
    return _truncate("\n".join(shown) + suffix, MAX_FIELD_VALUE_LENGTH)


# ---------------------------------------------------------------------------
# /rule group
# ---------------------------------------------------------------------------

class RuleGroup(app_commands.Group):
    """Команды управления правилами."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(name="rule", description="Управление правилами бота")
        self.bot = bot

    @property
    def pool(self):
        return getattr(self.bot, "pool", None)

    @app_commands.command(name="list", description="Показать все правила")
    @app_commands.default_permissions(administrator=True)
    async def rule_list(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        rules = await rules_repo.get_rules(self.pool)
        if not rules:
            await interaction.followup.send("Правил не найдено.", ephemeral=True)
            return

        shown = rules[:10]
        lines = []
        for r in shown:
            status = "✅" if r["is_active"] else "⏸️"
            dry = " [DRY RUN]" if r.get("is_dry_run") else ""
            max_t = f" / {_fmt_seconds(r['max_time_sec'])}" if r.get("max_time_sec") else ""
            lines.append(
                f"{status} **#{r['id']}** `{r['action_type']}`{dry} "
                f"— {r['name']}{max_t}"
            )

        extra = f"\n…и ещё {len(rules) - 10}" if len(rules) > 10 else ""
        embed = discord.Embed(
            title=f"Правила ({len(rules)})",
            description="\n".join(lines) + extra,
            color=discord.Color.blurple(),
        )
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(name="toggle", description="Включить/выключить правило")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(rule_id="ID правила")
    async def rule_toggle(self, interaction: discord.Interaction, rule_id: int) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        rule = await rules_repo.get_rule_by_id(self.pool, rule_id)
        if not rule:
            await interaction.followup.send(f"Правило #{rule_id} не найдено.", ephemeral=True)
            return
        new_state = not rule["is_active"]
        await rules_repo.update_rule(self.pool, rule_id, {"is_active": new_state})
        icon = "✅" if new_state else "⏸️"
        word = "включено" if new_state else "выключено"
        await interaction.followup.send(f"{icon} Rule #{rule_id} {word}.", ephemeral=True)
        logger.info("admin.rule_toggle", rule_id=rule_id, is_active=new_state,
                    admin_id=interaction.user.id)

    @app_commands.command(name="info", description="Подробная информация о правиле")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(rule_id="ID правила")
    async def rule_info(self, interaction: discord.Interaction, rule_id: int) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        rule = await rules_repo.get_rule_by_id(self.pool, rule_id)
        if not rule:
            await interaction.followup.send(f"Правило #{rule_id} не найдено.", ephemeral=True)
            return

        status = "Активно" if rule["is_active"] else "Неактивно"
        dry = " [DRY RUN]" if rule.get("is_dry_run") else ""
        embed = discord.Embed(
            title=f"Rule #{rule['id']} — {rule['name']}{dry}",
            color=discord.Color.green() if rule["is_active"] else discord.Color.greyple(),
        )
        embed.add_field(name="Статус", value=status, inline=True)
        embed.add_field(name="Действие", value=rule["action_type"], inline=True)
        embed.add_field(name="Приоритет", value=str(rule["priority"]), inline=True)
        if rule.get("target_list"):
            embed.add_field(name="Список", value=rule["target_list"], inline=True)
        if rule.get("max_time_sec"):
            embed.add_field(name="Макс. время", value=_fmt_seconds(rule["max_time_sec"]), inline=True)
        if rule.get("channel_ids"):
            ch_list = ", ".join(f"<#{c}>" for c in rule["channel_ids"])
            embed.add_field(name="Каналы", value=ch_list, inline=False)
        if rule.get("action_params"):
            embed.add_field(name="Параметры", value=str(rule["action_params"]), inline=False)
        embed.set_footer(text=f"Создано: {rule['created_at'].strftime('%Y-%m-%d %H:%M UTC')}")
        await interaction.followup.send(embed=embed, ephemeral=True)


# ---------------------------------------------------------------------------
# /user group
# ---------------------------------------------------------------------------

class UserGroup(app_commands.Group):
    """Команды управления списками пользователей."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(name="user", description="Управление whitelist/blacklist")
        self.bot = bot

    @property
    def pool(self):
        return getattr(self.bot, "pool", None)

    @app_commands.command(name="add", description="Добавить пользователя в список")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        discord_user="Пользователь Discord",
        list_type="Тип списка",
    )
    @app_commands.choices(list_type=[
        app_commands.Choice(name="whitelist", value="whitelist"),
        app_commands.Choice(name="blacklist", value="blacklist"),
    ])
    async def user_add(
        self,
        interaction: discord.Interaction,
        discord_user: discord.Member,
        list_type: str,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        await users_repo.add_user(
            self.pool,
            discord_id=discord_user.id,
            list_type=list_type,
            username=discord_user.display_name,
        )
        await interaction.followup.send(
            f"✅ {discord_user.mention} добавлен в {list_type}.", ephemeral=True
        )
        logger.info("admin.user_add", target_id=discord_user.id, list_type=list_type,
                    admin_id=interaction.user.id)

    @app_commands.command(name="remove", description="Удалить пользователя из списка")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        discord_user="Пользователь Discord",
        list_type="Тип списка",
    )
    @app_commands.choices(list_type=[
        app_commands.Choice(name="whitelist", value="whitelist"),
        app_commands.Choice(name="blacklist", value="blacklist"),
    ])
    async def user_remove(
        self,
        interaction: discord.Interaction,
        discord_user: discord.Member,
        list_type: str,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        removed = await users_repo.remove_user(self.pool, discord_user.id, list_type)
        if removed:
            await interaction.followup.send(
                f"✅ {discord_user.mention} удалён из {list_type}.", ephemeral=True
            )
        else:
            await interaction.followup.send(
                f"⚠️ {discord_user.mention} не найден в {list_type}.", ephemeral=True
            )
        logger.info("admin.user_remove", target_id=discord_user.id, list_type=list_type,
                    removed=removed, admin_id=interaction.user.id)

    @app_commands.command(name="check", description="Проверить в каких списках пользователь")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(discord_user="Пользователь Discord")
    async def user_check(
        self,
        interaction: discord.Interaction,
        discord_user: discord.Member,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        in_whitelist = await users_repo.is_in_list(self.pool, discord_user.id, "whitelist")
        in_blacklist = await users_repo.is_in_list(self.pool, discord_user.id, "blacklist")

        lines = []
        if in_whitelist:
            lines.append("✅ whitelist")
        if in_blacklist:
            lines.append("🚫 blacklist")
        if not lines:
            lines.append("Ни в одном списке")

        embed = discord.Embed(
            title=f"Списки: {discord_user.display_name}",
            description="\n".join(lines),
            color=discord.Color.blurple(),
        )
        await interaction.followup.send(embed=embed, ephemeral=True)


# ---------------------------------------------------------------------------
# /stats group
# ---------------------------------------------------------------------------

class StatsGroup(app_commands.Group):
    """Команды просмотра статистики."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(name="stats", description="Статистика бота")
        self.bot = bot

    @property
    def pool(self):
        return getattr(self.bot, "pool", None)

    @app_commands.command(name="today", description="Статистика действий за сегодня")
    @app_commands.default_permissions(administrator=True)
    async def stats_today(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        data = await stats_repo.get_today_stats(self.pool)
        embed = discord.Embed(title="Статистика за сегодня", color=discord.Color.blurple())
        embed.add_field(name="Всего действий", value=str(data["total_actions"]), inline=False)
        for action_type, cnt in sorted(data["actions_by_type"].items()):
            embed.add_field(name=action_type, value=str(cnt), inline=True)
        await interaction.followup.send(embed=embed, ephemeral=True)

    @app_commands.command(name="user", description="Статистика пользователя за 30 дней")
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(discord_user="Пользователь Discord")
    async def stats_user(
        self,
        interaction: discord.Interaction,
        discord_user: discord.Member,
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return
        data = await stats_repo.get_user_stats(self.pool, discord_user.id)
        voice_sec = data["total_voice_seconds"]
        embed = discord.Embed(
            title=f"Статистика: {discord_user.display_name}",
            color=discord.Color.blurple(),
        )
        embed.add_field(name="Время в войсе (30д)", value=_fmt_seconds(voice_sec), inline=True)
        embed.add_field(name="Действий применено (30д)", value=str(data["total_actions"]), inline=True)
        for action_type, cnt in sorted(data["actions_by_type"].items()):
            embed.add_field(name=action_type, value=str(cnt), inline=True)
        await interaction.followup.send(embed=embed, ephemeral=True)


# ---------------------------------------------------------------------------
# /tracking group
# ---------------------------------------------------------------------------

class TrackingGroup(app_commands.Group):
    """Команды публикации отчётов по отслеживаемым участникам."""

    def __init__(self, bot: commands.Bot) -> None:
        super().__init__(name="tracking", description="Отчёты отслеживаемых участников")
        self.bot = bot

    @property
    def pool(self):
        return getattr(self.bot, "pool", None)

    async def _report_channel(self, channel_id: int) -> discord.TextChannel | None:
        try:
            channel = self.bot.get_channel(channel_id)
            if channel is None:
                channel = await self.bot.fetch_channel(channel_id)
            if not isinstance(channel, discord.TextChannel):
                return None
            return channel if channel.permissions_for(channel.guild.me).send_messages else None
        except (AttributeError, discord.HTTPException, OSError):
            logger.warning("admin.tracking_report.channel_unavailable", channel_id=channel_id)
            return None

    @app_commands.command(name="report", description="Опубликовать отчёт активности")
    @app_commands.default_permissions(administrator=True)
    async def report(
        self,
        interaction: discord.Interaction,
        period: Literal["today", "week", "month"] = "today",
    ) -> None:
        await interaction.response.defer(ephemeral=True)
        permissions = getattr(interaction.user, "guild_permissions", None)
        if not getattr(permissions, "administrator", False):
            await interaction.followup.send(
                "Эта команда доступна только администраторам.", ephemeral=True
            )
            return
        if not self.pool:
            await interaction.followup.send("Pool недоступен.", ephemeral=True)
            return

        try:
            settings = await tracking_repo.get_tracking_settings(self.pool)
        except Exception:
            logger.exception("admin.tracking_report.settings_failed")
            await interaction.followup.send("Не удалось подготовить отчёт. Попробуйте позже.", ephemeral=True)
            return
        report_channel_id = settings.get("report_channel_id")
        if report_channel_id is None:
            await interaction.followup.send(
                "Сначала выберите канал отчётов в админке.", ephemeral=True
            )
            return
        channel = await self._report_channel(report_channel_id)
        if channel is None:
            await interaction.followup.send("Канал отчётов недоступен.", ephemeral=True)
            return

        try:
            active_members = [
                row for row in await tracking_repo.list_tracked_members(self.pool) if row["is_active"]
            ]
            if not active_members:
                await interaction.followup.send("Нет активных отслеживаемых участников.", ephemeral=True)
                return

            now = datetime.now(timezone.utc)
            period_start, period_end = _tracking_period_bounds(period, now)
            schedules = {
                row["discord_id"]: MemberSchedule(
                    set(row["work_days"]),
                    _as_time(row["work_start"]),
                    _as_time(row["work_end"]),
                    row["timezone"],
                )
                for row in active_members
            }
            sessions = await tracking_repo.load_report_sessions(
                self.pool, list(schedules), period_start, period_end, now
            )
            totals = calculate_member_totals(sessions, schedules, period_start, period_end)
            names = {
                row["discord_id"]: str(row["username"] or row["discord_id"])
                for row in active_members
            }
            embed = discord.Embed(
                title=f"Отчёт отслеживания · {period}", color=discord.Color.blurple()
            )
            visible_members = active_members[:MAX_MEMBER_FIELDS]
            for row in visible_members:
                total = totals[row["discord_id"]]
                embed.add_field(
                    name=_truncate(names[row["discord_id"]], MAX_FIELD_NAME_LENGTH),
                    value=(
                        f"Всего: {_fmt_seconds(total.total_seconds)}\n"
                        f"Сессий: {total.session_count}\n"
                        f"Рабочее: {_fmt_seconds(total.work_seconds)}"
                    ),
                    inline=False,
                )
            hidden_members = len(active_members) - len(visible_members)
            if hidden_members:
                embed.add_field(
                    name="Участники",
                    value=f"Показаны первые {len(visible_members)}. Ещё: {hidden_members}.",
                    inline=False,
                )

            overlaps = calculate_pair_overlaps(sessions, set(schedules), period_start, period_end)
            stack_lines = [
                f"{names.get(first, str(first))} + {names.get(second, str(second))} · "
                f"<#{overlap.channel_id}> · {_fmt_seconds(overlap.seconds)}"
                for overlap in overlaps
                for first, second in [overlap.member_ids]
            ]
            embed.add_field(name="Стаки", value=_summarize_stacks(stack_lines), inline=False)
        except Exception:
            logger.exception("admin.tracking_report.build_failed", period=period)
            await interaction.followup.send("Не удалось подготовить отчёт. Попробуйте позже.", ephemeral=True)
            return
        try:
            await channel.send(embed=embed)
        except (AttributeError, discord.HTTPException, OSError):
            await interaction.followup.send("Не удалось отправить отчёт в настроенный канал.", ephemeral=True)
            return
        await interaction.followup.send(
            f"Отчёт отправлен в <#{report_channel_id}>.", ephemeral=True
        )

# ---------------------------------------------------------------------------
# Cog
# ---------------------------------------------------------------------------

class AdminCommands(commands.Cog):
    """Slash-команды для администрирования бота."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot
        bot.tree.add_command(RuleGroup(bot))
        bot.tree.add_command(UserGroup(bot))
        bot.tree.add_command(StatsGroup(bot))
        bot.tree.add_command(TrackingGroup(bot))

    @app_commands.command(name="ping", description="Проверка отклика бота")
    async def ping(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message("Pong!", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AdminCommands(bot))
