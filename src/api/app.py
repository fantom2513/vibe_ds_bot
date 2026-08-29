"""
FastAPI приложение Voice Bot API.
Роутеры: rules, users, schedules, logs, dashboard, stats, health.
Пул БД устанавливается извне (main) в app.state.pool.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers import auth, dashboard, guild, kick_targets, logs, members, mute_levels, rules, schedules, settings, stacking_pairs, stats, tracking, users

app = FastAPI(
    title="Voice Bot API",
    description="API для управления правилами и списками Discord Voice Bot",
)


@app.get("/health")
@app.get("/api/health")
async def health(request: Request) -> dict[str, bool | str]:
    """
    Health check для контейнера, балансировщиков и внешнего мониторинга (Uptime Kuma).
    Без аутентификации. Всегда отвечает 200 — деградация видна по полям, не по коду ответа.
    """
    bot = getattr(request.app.state, "bot", None)
    discord_connected = bool(bot and bot.is_ready())

    pool = getattr(request.app.state, "pool", None)
    db_connected = False
    if pool is not None:
        try:
            async with pool.acquire() as conn:
                await conn.execute("SELECT 1")
            db_connected = True
        except Exception:
            db_connected = False

    return {
        "status": "ok",
        "discord_connected": discord_connected,
        "db_connected": db_connected,
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:80", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(rules.router, prefix="/api", tags=["rules"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(schedules.router, prefix="/api", tags=["schedules"])
app.include_router(logs.router, prefix="/api", tags=["logs"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(stats.router, prefix="/api", tags=["stats"])
app.include_router(kick_targets.router, prefix="/api", tags=["kick-targets"])
app.include_router(stacking_pairs.router, prefix="/api", tags=["stacking-pairs"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(members.router, prefix="/api", tags=["members"])
app.include_router(mute_levels.router, prefix="/api", tags=["mute-levels"])
app.include_router(guild.router, prefix="/api", tags=["guild"])
app.include_router(tracking.router, prefix="/api", tags=["tracking"])
