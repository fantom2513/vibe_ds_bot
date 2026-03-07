"""
Discord OAuth2 аутентификация.
GET  /auth/discord/login    — редирект на Discord
GET  /auth/discord/callback — обмен кода на токен, установка cookie
POST /auth/logout           — удалить cookie
GET  /auth/me               — текущий пользователь
"""
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from jose import jwt

from src.api.deps import get_current_user
from src.config.settings import get_settings

router = APIRouter()
log = structlog.get_logger()


@router.get("/discord/login")
async def discord_login() -> RedirectResponse:
    settings = get_settings()
    params = urlencode({
        "client_id": settings.DISCORD_CLIENT_ID,
        "redirect_uri": settings.DISCORD_REDIRECT_URI,
        "response_type": "code",
        "scope": "identify",
    })
    return RedirectResponse(f"https://discord.com/oauth2/authorize?{params}")


@router.get("/discord/callback")
async def discord_callback(code: str) -> RedirectResponse:
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        # 1. Exchange code → access_token
        token_resp = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.DISCORD_REDIRECT_URI,
                "client_id": settings.DISCORD_CLIENT_ID,
                "client_secret": settings.DISCORD_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            log.warning("auth.token_exchange_failed", status=token_resp.status_code)
            raise HTTPException(502, "Discord auth failed")

        access_token = token_resp.json()["access_token"]

        # 2. Get Discord user info
        user_resp = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            raise HTTPException(502, "Failed to get Discord user")

        discord_user = user_resp.json()

    # 3. Check allowlist
    if int(discord_user["id"]) not in settings.ALLOWED_DISCORD_IDS:
        log.warning("auth.access_denied", discord_id=discord_user["id"])
        raise HTTPException(403, "Access denied")

    # 4. Build avatar URL
    avatar_url = None
    if discord_user.get("avatar"):
        avatar_url = (
            f"https://cdn.discordapp.com/avatars/"
            f"{discord_user['id']}/{discord_user['avatar']}.png"
        )

    # 5. Create JWT
    payload = {
        "sub": discord_user["id"],
        "username": discord_user["username"],
        "avatar": avatar_url,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    # 6. Set httpOnly cookie → redirect to dashboard
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.JWT_EXPIRE_HOURS * 3600,
        path="/",
    )
    log.info("auth.login_success", discord_id=discord_user["id"], username=discord_user["username"])
    return response


@router.post("/logout")
async def logout() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.delete_cookie("access_token", path="/")
    return response


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)) -> dict:
    return current_user
