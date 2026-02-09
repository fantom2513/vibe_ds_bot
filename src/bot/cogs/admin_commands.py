"""
Cog: админ-команды. Slash-команда /ping — заглушка для проверки регистрации команд.
"""
import discord
from discord import app_commands
from discord.ext import commands


class AdminCommands(commands.Cog):
    """Slash-команды для проверки и администрирования."""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="ping", description="Проверка отклика бота")
    async def ping(self, interaction: discord.Interaction) -> None:
        await interaction.response.send_message("Pong!", ephemeral=False)


async def setup(bot: commands.Bot) -> None:
    await bot.add_cog(AdminCommands(bot))
