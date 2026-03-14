"""
MuteTracker: отслеживание "полного мута" (self_mute AND self_deaf).
Singleton mute_tracker используется в voice_manager и scheduler.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

import structlog

log = structlog.get_logger()


@dataclass
class MuteSession:
    discord_id: int
    channel_id: int
    started_at: datetime
    is_active: bool = True


class MuteTracker:
    def __init__(self) -> None:
        # discord_id → MuteSession
        self._active: dict[int, MuteSession] = {}

    def is_fully_muted(self, member) -> bool:
        """Полный мут = self_mute AND self_deaf (не server mute)."""
        if not member.voice:
            return False
        return member.voice.self_mute and member.voice.self_deaf

    def start_mute(self, member) -> MuteSession | None:
        """Начать мут-сессию. Возвращает None если уже активна."""
        if member.id in self._active:
            return None
        session = MuteSession(
            discord_id=member.id,
            channel_id=member.voice.channel.id,
            started_at=datetime.now(timezone.utc),
        )
        self._active[member.id] = session
        log.info("mute_tracker.start", discord_id=str(member.id))
        return session

    def end_mute(self, member_id: int) -> MuteSession | None:
        """Завершить мут-сессию. Возвращает сессию или None."""
        session = self._active.pop(member_id, None)
        if session:
            log.info(
                "mute_tracker.end",
                discord_id=str(member_id),
                duration_sec=self.get_duration(session),
            )
        return session

    def get_duration(self, session: MuteSession) -> int:
        """Секунды с момента старта сессии."""
        return int((datetime.now(timezone.utc) - session.started_at).total_seconds())

    def get_active(self) -> dict[int, MuteSession]:
        return dict(self._active)

    def get_session(self, member_id: int) -> MuteSession | None:
        return self._active.get(member_id)


# Singleton
mute_tracker = MuteTracker()
