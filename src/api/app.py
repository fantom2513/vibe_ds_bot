"""
FastAPI приложение Voice Bot API.
Роутеры: rules, users, schedules, logs, dashboard, stats, health.
Пул БД устанавливается извне (main) в app.state.pool.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers import dashboard, kick_targets, logs, rules, schedules, stacking_pairs, stats, users

app = FastAPI(
    title="Voice Bot API",
    description="API для управления правилами и списками Discord Voice Bot",
)


@app.get("/health")
def health() -> dict[str, str]:
    """Health check для контейнера и балансировщиков. Без аутентификации."""
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rules.router, prefix="/api", tags=["rules"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(schedules.router, prefix="/api", tags=["schedules"])
app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(kick_targets.router, prefix="/api", tags=["kick-targets"])
app.include_router(stacking_pairs.router, prefix="/api", tags=["stacking-pairs"])
