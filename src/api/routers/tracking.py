"""API управления отслеживаемыми участниками."""
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends

from src.api.deps import get_current_user, get_db_pool
from src.api.schemas import TrackedMemberCreate, TrackedMemberResponse
from src.db.repositories import tracking_repo

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
    return TrackedMemberResponse(**await tracking_repo.create_tracked_member(pool, body.model_dump()))
