"""FastAPI dependencies for authenticated access."""
from __future__ import annotations

from typing import Awaitable, Callable, Optional

from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.session import SessionData, get_session_manager


class SessionUser(BaseModel):
    user_id: str
    email: str
    name: str | None = None
    roles: list[str]
    expires_at: int


async def _resolve_session(request: Request) -> SessionData:
    cookie_value = request.cookies.get(settings.session_cookie_name)
    if not cookie_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session token")
    session = await get_session_manager().resolve_session(cookie_value)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")
    return session


async def get_current_user(session: SessionData = Depends(_resolve_session)) -> SessionUser:
    return SessionUser(
        user_id=session.user_id,
        email=session.email,
        name=session.name,
        roles=session.roles,
        expires_at=session.expires_at,
    )


def require_roles(*required_roles: str) -> Callable[[SessionUser], Awaitable[SessionUser]]:
    async def dependency(user: SessionUser = Depends(get_current_user)) -> SessionUser:
        if not any(role in user.roles for role in required_roles):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return dependency


async def get_optional_user(request: Request) -> Optional[SessionUser]:
    cookie_value = request.cookies.get(settings.session_cookie_name)
    if not cookie_value:
        return None
    session = await get_session_manager().resolve_session(cookie_value)
    if not session:
        return None
    return SessionUser(
        user_id=session.user_id,
        email=session.email,
        name=session.name,
        roles=session.roles,
        expires_at=session.expires_at,
    )


__all__ = ["SessionUser", "get_current_user", "get_optional_user", "require_roles"]