"""Auth0 helper utilities for token exchange and verification."""
from __future__ import annotations

import time
from typing import Any, Dict

import httpx
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode

from app.core.config import settings

_jwks_cache: dict[str, Any] | None = None
_jwks_fetched_at = 0.0
_JWKS_TTL = 600


def _issuer() -> str:
    domain = settings.auth0_domain.strip()
    if not domain:
        raise RuntimeError("Auth0 domain is not configured")
    return f"https://{domain}/"


async def _load_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    now = time.time()
    if _jwks_cache and now - _jwks_fetched_at < _JWKS_TTL:
        return _jwks_cache
    url = f"{_issuer()}.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = now
        return _jwks_cache


async def verify_jwt(token: str, *, audience: str | None = None) -> dict[str, Any]:
    """Validate a JWT issued by Auth0 and return its claims."""

    unverified = jwt.get_unverified_header(token)
    jwks = await _load_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == unverified.get("kid")), None)
    if not key:
        raise JWTError("Unable to find matching JWK")

    public_key = jwk.construct(key)
    message, encoded_sig = token.rsplit(".", 1)
    decoded_sig = base64url_decode(encoded_sig.encode())
    if not public_key.verify(message.encode(), decoded_sig):
        raise JWTError("Invalid JWT signature")

    claims = jwt.get_unverified_claims(token)
    audience = audience or settings.auth0_audience or claims.get("aud")
    issuer = _issuer().rstrip("/")
    if claims.get("iss") != issuer:
        raise JWTError("Issuer mismatch")
    if audience and audience not in claims.get("aud", [] if isinstance(claims.get("aud"), list) else claims.get("aud")):
        raise JWTError("Audience mismatch")
    if claims.get("exp") and time.time() > claims["exp"]:
        raise JWTError("Token expired")
    return claims


async def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict[str, Any]:
    token_url = f"{_issuer()}oauth/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": settings.auth0_client_id,
        "client_secret": settings.auth0_client_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(token_url, data=payload)
        resp.raise_for_status()
        return resp.json()


async def fetch_userinfo(access_token: str) -> Dict[str, Any]:
    url = f"{_issuer()}userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()


def extract_roles(claims: dict[str, Any]) -> list[str]:
    custom_claim = settings.auth0_roles_claim
    if custom_claim and custom_claim in claims:
        value = claims[custom_claim]
        if isinstance(value, list):
            return [str(role) for role in value]
        if isinstance(value, str):
            return [value]
    app_metadata = claims.get("https://app_metadata") or {}
    roles = app_metadata.get("roles") if isinstance(app_metadata, dict) else None
    if roles and isinstance(roles, list):
        return [str(role) for role in roles]
    return []


__all__ = [
    "verify_jwt",
    "exchange_code_for_tokens",
    "fetch_userinfo",
    "extract_roles",
]