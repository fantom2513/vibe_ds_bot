"""
Pydantic-схемы для FastAPI (rules, users, schedules, logs, dashboard).
"""
from datetime import datetime
from typing import Annotated, Any, Literal, Optional

from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer

# Discord snowflake IDs exceed JS Number.MAX_SAFE_INTEGER (2^53).
# Serialise as strings in JSON responses; accept int or str on input.
DiscordId = Annotated[
    int,
    BeforeValidator(lambda v: int(v) if isinstance(v, str) else v),
    PlainSerializer(lambda v: str(v), return_type=str),
]


# --- Rules ---

class RuleCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    is_active: bool = True
    is_dry_run: bool = False
    target_list: Optional[Literal["whitelist", "blacklist"]] = None
    channel_ids: Optional[list[int]] = None
    max_time_sec: Optional[int] = None
    action_type: str = Field(..., max_length=20)
    action_params: dict[str, Any] = Field(default_factory=dict)
    schedule_cron: Optional[str] = Field(None, max_length=100)
    schedule_tz: str = Field(default="UTC", max_length=50)
    priority: int = 0


class RuleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_dry_run: Optional[bool] = None
    target_list: Optional[Literal["whitelist", "blacklist"]] = None
    channel_ids: Optional[list[int]] = None
    max_time_sec: Optional[int] = None
    action_type: Optional[str] = Field(None, max_length=20)
    action_params: Optional[dict[str, Any]] = None
    schedule_cron: Optional[str] = Field(None, max_length=100)
    schedule_tz: Optional[str] = Field(None, max_length=50)
    priority: Optional[int] = None


class RuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    is_dry_run: bool
    target_list: Optional[str] = None
    channel_ids: Optional[list[int]] = None
    max_time_sec: Optional[int] = None
    action_type: str
    action_params: dict[str, Any]
    schedule_cron: Optional[str] = None
    schedule_tz: str
    priority: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Users (whitelist/blacklist) ---

class UserListCreate(BaseModel):
    discord_id: DiscordId
    list_type: Literal["whitelist", "blacklist"]
    username: Optional[str] = Field(None, max_length=100)
    reason: Optional[str] = None


class UserListResponse(BaseModel):
    id: int
    discord_id: DiscordId
    username: Optional[str] = None
    list_type: str
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListBulkEntry(BaseModel):
    discord_id: DiscordId
    list_type: Literal["whitelist", "blacklist"]
    username: Optional[str] = None
    reason: Optional[str] = None


class UserListBulk(BaseModel):
    entries: list[UserListBulkEntry]


# --- Schedules ---

class ScheduleCreate(BaseModel):
    rule_id: int
    cron_expr: str = Field(..., max_length=100)
    action: Literal["enable", "disable"]
    timezone: str = Field(default="UTC", max_length=50)


class ScheduleUpdate(BaseModel):
    cron_expr: Optional[str] = Field(None, max_length=100)
    action: Optional[Literal["enable", "disable"]] = None
    timezone: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class ScheduleResponse(BaseModel):
    id: int
    rule_id: int
    cron_expr: str
    action: str
    timezone: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Logs ---

class ActionLogResponse(BaseModel):
    id: int
    rule_id: Optional[int] = None
    discord_id: DiscordId
    action_type: Optional[str] = None
    channel_id: Optional[DiscordId] = None
    details: dict[str, Any]
    executed_at: datetime

    model_config = {"from_attributes": True}


class LogsFilter(BaseModel):
    discord_id: Optional[DiscordId] = None
    rule_id: Optional[int] = None
    action_type: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=500)
    offset: int = Field(default=0, ge=0)


# --- Dashboard ---

class DashboardResponse(BaseModel):
    active_rules: list[RuleResponse]
    recent_logs: list[ActionLogResponse]
    voice_online_count: Optional[int] = None


# --- Stats (optional) ---

class StatsOverviewResponse(BaseModel):
    total_actions: int
    actions_by_type: dict[str, int]


class UserStatsResponse(BaseModel):
    discord_id: DiscordId
    total_actions: int
    actions_by_type: dict[str, int]


# --- Kick targets ---

class KickTargetCreate(BaseModel):
    discord_id: DiscordId
    username: Optional[str] = Field(None, max_length=100)
    timeout_sec: int = Field(default=1800, ge=60, le=86400)
    max_timeout_sec: Optional[int] = Field(None, ge=60, le=86400)


class KickTargetUpdate(BaseModel):
    timeout_sec: Optional[int] = Field(None, ge=60, le=86400)
    max_timeout_sec: Optional[int] = Field(None, ge=60, le=86400)
    is_active: Optional[bool] = None
    username: Optional[str] = Field(None, max_length=100)


class KickTargetResponse(BaseModel):
    id: int
    discord_id: DiscordId
    username: Optional[str] = None
    timeout_sec: int
    max_timeout_sec: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Mute Levels ---

class MuteLevelCreate(BaseModel):
    level: int
    xp_required: int
    role_id: Optional[int] = None
    label: str


class MuteLevelUpdate(BaseModel):
    xp_required: Optional[int] = None
    role_id: Optional[int] = None
    label: Optional[str] = None


class MuteLevelResponse(BaseModel):
    level: int
    xp_required: int
    role_id: Optional[int] = None
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MuteXPResponse(BaseModel):
    discord_id: DiscordId
    xp: int
    level: int
    total_mute_seconds: int
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MuteXPAdjust(BaseModel):
    xp: int


# --- Stacking pairs ---

class StackingPairCreate(BaseModel):
    user_id_1: DiscordId
    user_id_2: DiscordId
    target_channel_id: DiscordId


class StackingPairResponse(BaseModel):
    id: int
    user_id_1: DiscordId
    user_id_2: DiscordId
    target_channel_id: DiscordId
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
