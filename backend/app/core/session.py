"""Session and state management for authenticated users."""
from __future__ import annotations

import asyncio
import json
import logging
import secrets
import time
from typing import Any, Dict, Optional

from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from pydantic import BaseModel, Field
from redis import asyncio as redis_async

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret

logger = logging.getLogger("veridian.session")


class SessionData(BaseModel):
    """Sanitized view of an authenticated principal."""

    user_id: str
    email: str
    name: str | None = None
    roles: list[str] = Field(default_factory=list)
    access_token: str
    refresh_token: str | None = None
    expires_at: int


class _KeyValueStore:
    def __init__(self) -> None:
        self._redis: redis_async.Redis | None = None
        self._memory: dict[str, tuple[dict[str, Any], float]] = {}
        self._lock = asyncio.Lock()
        if settings.redis_url.startswith("memory://"):
            logger.warning("redis_url=memory:// detected; falling back to in-memory session store")
            return
        try:
            self._redis = redis_async.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("Redis initialization failed, using in-memory store: %s", exc)

    async def set(self, key: str, value: dict[str, Any], ttl: int) -> None:
        if self._redis is not None:
            try:
                await self._redis.set(key, json.dumps(value), ex=ttl)
                return
            except Exception as exc:  # pragma: no cover - redis outage fallback
                logger.error("Redis SET failed (%s); reverting to memory store", exc)
                self._redis = None
        async with self._lock:
            self._memory[key] = (value, time.time() + ttl)

    async def get(self, key: str) -> Optional[dict[str, Any]]:
        if self._redis is not None:
            try:
                payload = await self._redis.get(key)
                return json.loads(payload) if payload else None
            except Exception as exc:  # pragma: no cover
                logger.error("Redis GET failed (%s); reverting to memory store", exc)
                self._redis = None
        async with self._lock:
            record = self._memory.get(key)
            if not record:
                return None
            payload, expires = record
            if expires < time.time():
                self._memory.pop(key, None)
                return None
            return payload

    async def delete(self, key: str) -> None:
        if self._redis is not None:
            try:
                await self._redis.delete(key)
                return
            except Exception as exc:  # pragma: no cover
                logger.error("Redis DEL failed (%s); reverting to memory store", exc)
                self._redis = None
        async with self._lock:
            self._memory.pop(key, None)


class SessionManager:
    def __init__(self) -> None:
        self._store = _KeyValueStore()
        self._signer = TimestampSigner(settings.session_secret)

    def _session_key(self, session_id: str) -> str:
        return f"session:{session_id}"

    def _state_key(self, state: str) -> str:
        return f"auth-state:{state}"

    async def create_session(self, payload: SessionData) -> str:
        session_id = secrets.token_urlsafe(32)
        record = payload.model_dump()
        record["access_token"] = encrypt_secret(payload.access_token)
        if payload.refresh_token:
            record["refresh_token"] = encrypt_secret(payload.refresh_token)
        await self._store.set(self._session_key(session_id), record, settings.session_ttl_seconds)
        signed = self._signer.sign(session_id).decode()
        return signed

    async def resolve_session(self, signed_token: str) -> Optional[SessionData]:
        try:
            session_id = self._signer.unsign(signed_token, max_age=settings.session_ttl_seconds).decode()
        except (BadSignature, SignatureExpired):
            return None
        record = await self._store.get(self._session_key(session_id))
        if not record:
            return None
        try:
            access_token = decrypt_secret(record["access_token"])
            refresh_token = (
                decrypt_secret(record["refresh_token"])
                if record.get("refresh_token")
                else None
            )
        except Exception:  # pragma: no cover - tampering guard
            await self._store.delete(self._session_key(session_id))
            return None
        return SessionData(
            user_id=record["user_id"],
            email=record["email"],
            name=record.get("name"),
            roles=list(record.get("roles", [])),
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=int(record.get("expires_at", 0)),
        )

    async def destroy_session(self, signed_token: str) -> None:
        try:
            session_id = self._signer.unsign(signed_token, max_age=settings.session_ttl_seconds).decode()
        except (BadSignature, SignatureExpired):
            return
        await self._store.delete(self._session_key(session_id))

    async def issue_state(self, redirect_url: str) -> str:
        state = secrets.token_urlsafe(24)
        await self._store.set(self._state_key(state), {"redirect": redirect_url}, settings.auth_state_ttl_seconds)
        return state

    async def consume_state(self, state: str) -> Optional[str]:
        key = self._state_key(state)
        record = await self._store.get(key)
        if record:
            await self._store.delete(key)
            return record.get("redirect")
        return None


_manager: SessionManager | None = None


def get_session_manager() -> SessionManager:
    global _manager
    if _manager is None:
        _manager = SessionManager()
    return _manager


__all__ = ["SessionData", "SessionManager", "get_session_manager"]