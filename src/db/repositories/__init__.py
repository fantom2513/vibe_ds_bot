"""Репозитории для работы с БД (asyncpg)."""

from . import logs_repo, rules_repo, schedules_repo, users_repo

__all__ = [
    "logs_repo",
    "rules_repo",
    "schedules_repo",
    "users_repo",
]
