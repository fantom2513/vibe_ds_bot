"""
Проверка критерия готовности Agent 3: импорт настроек, логгер, permissions с mock.
Запуск из корня: python -m scripts.check_agent3
"""
import sys
from pathlib import Path

# корень проекта в PYTHONPATH
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))


def main() -> None:
    # 1) load_config_yaml — без .env
    from src.config.settings import load_config_yaml

    yaml_cfg = load_config_yaml()
    assert "bot" in yaml_cfg and "logging" in yaml_cfg
    print("load_config_yaml:", list(yaml_cfg.keys()))

    # 2) get_settings / Settings — требуют .env; только импорт
    from src.config import Settings, get_settings

    try:
        s = get_settings()
        print("get_settings:", s.API_HOST, s.API_PORT)
    except Exception as e:
        print("get_settings (нужен .env):", type(e).__name__)

    # 3) setup_logging
    from src.utils.logging import setup_logging

    setup_logging(config_yaml=yaml_cfg)
    print("setup_logging: OK")

    # 4) can_mute, can_move, can_kick с mock Member и Guild
    from unittest.mock import MagicMock

    from src.utils.permissions import can_kick, can_move, can_mute

    guild = MagicMock()
    guild.me = MagicMock()
    guild.me.guild_permissions = MagicMock()
    guild.me.guild_permissions.mute_members = True
    guild.me.guild_permissions.move_members = True

    member = MagicMock()
    member.guild = guild

    assert can_mute(member, guild) is True
    assert can_move(member, guild) is True
    assert can_kick(member, guild) is True

    guild.me.guild_permissions.mute_members = False
    assert can_mute(member, guild) is False

    print("can_mute, can_move, can_kick (mock): OK")
    print("Agent 3 criterion: passed.")


if __name__ == "__main__":
    main()
