"""
Pydantic-схемы для FastAPI (rules, users, schedules, logs, dashboard).
"""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# --- Rules ---

class RuleCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    is_active: bool = True
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
    discord_id: int
    list_type: Literal["whitelist", "blacklist"]
    username: Optional[str] = Field(None, max_length=100)
    reason: Optional[str] = None


class UserListResponse(BaseModel):
    id: int
    discord_id: int
    username: Optional[str] = None
    list_type: str
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListBulkEntry(BaseModel):
    discord_id: int
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
    discord_id: int
    action_type: Optional[str] = None
    channel_id: Optional[int] = None
    details: dict[str, Any]
    executed_at: datetime

    model_config = {"from_attributes": True}


class LogsFilter(BaseModel):
    discord_id: Optional[int] = None
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
    discord_id: int
    total_actions: int
    actions_by_type: dict[str, int]


# --- Kick targets ---

class KickTargetCreate(BaseModel):
    discord_id: int
    username: Optional[str] = Field(None, max_length=100)
    timeout_sec: int = Field(default=3600, ge=60, le=86400)


class KickTargetUpdate(BaseModel):
    timeout_sec: Optional[int] = Field(None, ge=60, le=86400)
    is_active: Optional[bool] = None
    username: Optional[str] = Field(None, max_length=100)


class KickTargetResponse(BaseModel):
    id: int
    discord_id: int
    username: Optional[str] = None
    timeout_sec: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Stacking pairs ---

class StackingPairCreate(BaseModel):
    user_id_1: int
    user_id_2: int
    target_channel_id: int


class StackingPairResponse(BaseModel):
    id: int
    user_id_1: int
    user_id_2: int
    target_channel_id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
