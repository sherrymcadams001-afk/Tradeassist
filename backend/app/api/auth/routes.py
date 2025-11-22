"""Authentication endpoints backed by Auth0 sessions."""
from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.core import auth0
from app.core.config import settings
from app.core.security import SessionUser, get_current_user
from app.core.session import SessionData, get_session_manager


router = APIRouter(prefix="/auth", tags=["auth"])
_allowed_redirects = [origin.strip() for origin in settings.frontend_origin.split(",") if origin.strip()] or [
    "http://localhost:5173"
]


def _normalize_redirect(target: str | None) -> str:
    if not target:
        return _allowed_redirects[0]
    if target.startswith("/"):
        base = _allowed_redirects[0].rstrip("/")
        return f"{base}{target}"
    if any(target.startswith(origin.rstrip("/")) for origin in _allowed_redirects):
        return target
    return _allowed_redirects[0]


def _authorize_url(state: str) -> str:
    domain = settings.auth0_domain.strip()
    if not domain:
        raise HTTPException(status_code=500, detail="Auth0 not configured")
    redirect_uri = f"{settings.backend_base_url.rstrip('/')}/auth/callback"
    params = {
        "response_type": "code",
        "client_id": settings.auth0_client_id,
        "redirect_uri": redirect_uri,
        "scope": "openid profile email offline_access",
        "state": state,
    }
    if settings.auth0_audience:
        params["audience"] = settings.auth0_audience
    query = urlencode(params)
    return f"https://{domain}/authorize?{query}"


def _cookie_settings() -> dict[str, Any]:
    secure = settings.environment != "local"
    same_site = "none" if secure else "lax"
    return {
        "httponly": True,
        "secure": secure,
        "samesite": same_site,
        "max_age": settings.session_ttl_seconds,
        "path": "/",
    }


@router.get("/login")
async def start_login(redirect: str | None = Query(default=None)) -> JSONResponse:
    redirect_target = _normalize_redirect(redirect)
    manager = get_session_manager()
    state = await manager.issue_state(redirect_target)
    url = _authorize_url(state)
    return JSONResponse({"authorization_url": url, "state": state})


@router.get("/callback")
async def auth_callback(code: str, state: str, response: Response) -> Response:
    manager = get_session_manager()
    redirect_target = await manager.consume_state(state)
    if not redirect_target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state")
    redirect_uri = f"{settings.backend_base_url.rstrip('/')}/auth/callback"
    token_result = await auth0.exchange_code_for_tokens(code, redirect_uri)
    id_token = token_result.get("id_token")
    access_token = token_result.get("access_token")
    if not id_token or not access_token:
        raise HTTPException(status_code=500, detail="Auth0 response missing tokens")
    claims = await auth0.verify_jwt(id_token, audience=settings.auth0_client_id)
    profile = await auth0.fetch_userinfo(access_token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Unable to resolve user id")
    roles = auth0.extract_roles(claims)
    expires_at = int(time.time()) + int(token_result.get("expires_in", settings.session_ttl_seconds))
    session = SessionData(
        user_id=user_id,
        email=profile.get("email") or claims.get("email") or user_id,
        name=profile.get("name") or claims.get("name"),
        roles=roles,
        access_token=access_token,
        refresh_token=token_result.get("refresh_token"),
        expires_at=expires_at,
    )
    signed_cookie = await manager.create_session(session)
    redirect_response = RedirectResponse(url=redirect_target)
    redirect_response.set_cookie(settings.session_cookie_name, signed_cookie, **_cookie_settings())
    return redirect_response


@router.get("/session")
async def get_session(user: SessionUser = Depends(get_current_user)) -> dict[str, Any]:
    return {
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "name": user.name,
            "roles": user.roles,
            "expires_at": user.expires_at,
        }
    }


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict[str, str]:
    cookie_value = request.cookies.get(settings.session_cookie_name)
    if cookie_value:
        await get_session_manager().destroy_session(cookie_value)
    cookie_opts = _cookie_settings()
    response.delete_cookie(
        settings.session_cookie_name,
        path=cookie_opts.get("path", "/"),
        httponly=cookie_opts.get("httponly", True),
        secure=cookie_opts.get("secure", False),
        samesite=cookie_opts.get("samesite"),
    )
    return {"status": "ok"}