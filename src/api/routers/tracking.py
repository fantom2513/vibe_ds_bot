"""API управления отслеживаемыми участниками и предпросмотром отчёта."""
from datetime import datetime, time, timezone
from typing import Annotated
from zoneinfo import ZoneInfo

import asyncpg
import discord
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from src.api.deps import get_bot, get_current_user, get_db_pool
from src.api.schemas import (
    TrackedMemberCreate, TrackedMemberResponse, TrackedMemberUpdate,
    TrackingSettingsResponse, TrackingSettingsUpdate,
)
from src.db.repositories import tracking_repo
from src.engine.tracking_report import (
    MemberSchedule,
    calculate_all_together_seconds,
    calculate_daily_work_seconds,
    calculate_member_totals,
    calculate_pair_overlaps,
    daily_boundaries,
    period_bounds,
)
from src.config.settings import get_settings as get_app_settings

router = APIRouter()


@router.get("/tracking/members", response_model=list[TrackedMemberResponse])
async def list_members(
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> list[TrackedMemberResponse]:
    return [TrackedMemberResponse(**row) for row in await tracking_repo.list_tracked_members(pool)]


@router.post("/tracking/members", response_model=TrackedMemberResponse)
async def create_member(
    body: TrackedMemberCreate,
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> TrackedMemberResponse:
    payload = body.model_dump()
    payload["discord_id"] = body.discord_id
    return TrackedMemberResponse(**await tracking_repo.create_tracked_member(pool, payload))


@router.patch("/tracking/members/{discord_id}", response_model=TrackedMemberResponse)
async def update_member(
    discord_id: int,
    body: TrackedMemberUpdate,
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> TrackedMemberResponse:
    row = await tracking_repo.update_tracked_member(pool, discord_id, body.model_dump(exclude_unset=True))
    if row is None:
        raise HTTPException(status_code=404, detail="Tracked member not found")
    return TrackedMemberResponse(**row)


@router.delete("/tracking/members/{discord_id}", status_code=204)
async def delete_member(
    discord_id: int,
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> None:
    if not await tracking_repo.delete_tracked_member(pool, discord_id):
        raise HTTPException(status_code=404, detail="Tracked member not found")


@router.get("/tracking/settings", response_model=TrackingSettingsResponse)
async def get_settings(
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> TrackingSettingsResponse:
    return TrackingSettingsResponse(**await tracking_repo.get_tracking_settings(pool))


@router.patch("/tracking/settings", response_model=TrackingSettingsResponse)
async def update_settings(
    body: TrackingSettingsUpdate,
    request: Request,
    _: Annotated[dict, Depends(get_current_user)],
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)],
) -> TrackingSettingsResponse:
    if body.report_channel_id is not None:
        bot = await get_bot(request)
        guild = bot.get_guild(get_app_settings().DISCORD_GUILD_ID)
        channel = guild.get_channel(body.report_channel_id) if guild else None
        if not isinstance(channel, discord.TextChannel) or not channel.permissions_for(guild.me).send_messages:
            raise HTTPException(status_code=400, detail="Report channel is unavailable or not sendable")
    return TrackingSettingsResponse(**await tracking_repo.set_report_channel(pool, body.report_channel_id))


@router.get("/tracking/text-channels")
async def list_text_channels(
    _: Annotated[dict, Depends(get_current_user)],
    bot=Depends(get_bot),
) -> list[dict[str, str]]:
    guild = bot.get_guild(get_app_settings().DISCORD_GUILD_ID)
    if guild is None:
        raise HTTPException(status_code=503, detail="Guild not available")
    return [
        {"id": str(channel.id), "name": channel.name}
        for channel in guild.text_channels
        if isinstance(channel, discord.TextChannel) and channel.permissions_for(guild.me).send_messages
    ]


def _as_time(value: str | time) -> time:
    return value if isinstance(value, time) else time.fromisoformat(value)


@router.get("/tracking/preview")
async def preview_report(
    request: Request,
    period: str = Query("today", pattern="^(today|week|month)$"),
    _: Annotated[dict, Depends(get_current_user)] = None,
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    period_start, period_end = period_bounds(period, now)
    active_members = [row for row in await tracking_repo.list_tracked_members(pool) if row["is_active"]]
    schedules = {
        row["discord_id"]: MemberSchedule(
            set(row["work_days"]), _as_time(row["work_start"]), _as_time(row["work_end"]), row["timezone"],
        ) for row in active_members
    }
    sessions = await tracking_repo.load_report_sessions(pool, list(schedules), period_start, period_end, now)
    totals = calculate_member_totals(sessions, schedules, period_start, period_end)
    bot = getattr(request.app.state, "bot", None)
    guild = bot.get_guild(get_app_settings().DISCORD_GUILD_ID) if bot is not None else None

    def current_username(row: dict) -> str | None:
        member = guild.get_member(row["discord_id"]) if guild is not None else None
        return member.display_name if member is not None else row["username"]

    return {
        "period_start": period_start.isoformat(), "period_end": period_end.isoformat(),
        "members": [
            {"discord_id": str(row["discord_id"]), "username": current_username(row), **totals[row["discord_id"]].__dict__}
            for row in active_members
        ],
        "overlaps": [
            {"member_ids": [str(member_id) for member_id in overlap.member_ids], "seconds": overlap.seconds}
            for overlap in calculate_pair_overlaps(sessions, set(schedules), period_start, period_end)
        ],
        "all_together_seconds": calculate_all_together_seconds(sessions, set(schedules), period_start, period_end),
    }


@router.get("/tracking/daily-work-hours")
async def daily_work_hours(
    request: Request,
    days: int = Query(14, ge=1, le=90),
    _: Annotated[dict, Depends(get_current_user)] = None,
    pool: Annotated[asyncpg.Pool, Depends(get_db_pool)] = None,
) -> dict:
    """Рабочие часы по дням за последние `days` дней — данные для столбчатой диаграммы."""
    msk = ZoneInfo("Europe/Moscow")
    now = datetime.now(timezone.utc)
    day_starts = daily_boundaries(days, now, "Europe/Moscow")

    active_members = [row for row in await tracking_repo.list_tracked_members(pool) if row["is_active"]]
    schedules = {
        row["discord_id"]: MemberSchedule(
            set(row["work_days"]), _as_time(row["work_start"]), _as_time(row["work_end"]), row["timezone"],
        ) for row in active_members
    }
    sessions = await tracking_repo.load_report_sessions(pool, list(schedules), day_starts[0], now, now)
    daily = calculate_daily_work_seconds(sessions, schedules, day_starts)

    bot = getattr(request.app.state, "bot", None)
    guild = bot.get_guild(get_app_settings().DISCORD_GUILD_ID) if bot is not None else None

    def current_username(row: dict) -> str | None:
        member = guild.get_member(row["discord_id"]) if guild is not None else None
        return member.display_name if member is not None else row["username"]

    return {
        "members": [
            {"discord_id": str(row["discord_id"]), "username": current_username(row)}
            for row in active_members
        ],
        "days": [
            {
                "date": day_start.astimezone(msk).date().isoformat(),
                **{str(member_id): seconds for member_id, seconds in day_totals.items()},
            }
            for day_start, day_totals in zip(day_starts, daily)
        ],
    }
