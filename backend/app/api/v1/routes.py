"""FastAPI surface for VERIDIAN control plane.

The control plane currently exposes:
1. Health checks
2. A descriptor for the single system-owned trading bot ("partner")
3. Tier catalog information that defines user entitlements
4. User profile endpoints so the frontend can tailor UX per tier

No persistence layer is wired yet; all data lives in memory so the API
shape can be validated before introducing storage or auth gates.
"""
from __future__ import annotations

import time
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Literal

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.core.security import SessionUser, get_current_user

router = APIRouter(prefix="/v1", tags=["veridian"])


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


NotificationLevel = Literal["silent", "summary", "verbose"]
ExplanationLevel = Literal["concise", "detailed"]


@dataclass(slots=True)
class BotDescriptor:
    id: str
    name: str
    description: str
    capabilities: list[str]
    universes: list[str]
    control_modes: list[str]


@dataclass(slots=True)
class TierDefinition:
    id: str
    label: str
    description: str
    max_allocation: float
    features: list[str]
    capabilities: list[str]


@dataclass(slots=True)
class UserPreferences:
    max_allocation: float
    symbols_whitelist: list[str]
    notification_level: NotificationLevel = "summary"
    explanation_level: ExplanationLevel = "concise"


@dataclass(slots=True)
class UserProfile:
    user_id: str
    tier: str
    preferences: UserPreferences
    updated_at: float = field(default_factory=lambda: time.time())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


SYSTEM_BOT = BotDescriptor(
    id="core_bot",
    name="VERIDIAN Core Partner",
    description=(
        "System-governed multi-venue trading partner that delivers insights, "
        "paper execution, and live execution depending on user tier"
    ),
    capabilities=["insights", "paper_trading", "live_trading", "explainability"],
    universes=[
        "BTC/USDT",
        "ETH/USDT",
        "SOL/USDT",
        "LINK/USDT",
        "ATOM/USDT",
        "AVAX/USDT",
        "MATIC/USDT",
    ],
    control_modes=["observe", "partner", "execute"],
)

TIERS: Dict[str, TierDefinition] = {
    "foundation": TierDefinition(
        id="foundation",
        label="Foundation",
        description="Signal intelligence + posture guidance. No automated execution.",
        max_allocation=0.0,
        features=["insights", "market_intel"],
        capabilities=["explainability"],
    ),
    "advance": TierDefinition(
        id="advance",
        label="Advance",
        description="Adds paper execution, sandbox order rehearsal, and deeper telemetry.",
        max_allocation=50_000.0,
        features=["insights", "paper_trading", "diagnostics"],
        capabilities=["explainability", "allocation_controls"],
    ),
    "prime": TierDefinition(
        id="prime",
        label="Prime",
        description="Full partner mode with live execution, dynamic hedging, and advanced explanations.",
        max_allocation=500_000.0,
        features=["insights", "paper_trading", "live_trading", "risk_overrides"],
        capabilities=["explainability", "allocation_controls", "latency_monitoring"],
    ),
}

_USER_PROFILES: Dict[str, UserProfile] = {}


def _default_preferences(tier_id: str) -> UserPreferences:
    tier = TIERS[tier_id]
    base_allocation = min(5_000.0, tier.max_allocation)
    default_symbols = SYSTEM_BOT.universes[:3]
    return UserPreferences(
        max_allocation=base_allocation,
        symbols_whitelist=default_symbols,
        notification_level="summary",
        explanation_level="concise",
    )


def _get_or_create_profile(user_id: str) -> UserProfile:
    profile = _USER_PROFILES.get(user_id)
    if profile:
        return profile
    profile = UserProfile(user_id=user_id, tier="foundation", preferences=_default_preferences("foundation"))
    _USER_PROFILES[user_id] = profile
    return profile


def _validate_preferences(tier_id: str, preferences: dict[str, Any]) -> UserPreferences:
    tier = TIERS[tier_id]
    max_alloc = float(preferences.get("max_allocation", tier.max_allocation))
    if max_alloc > tier.max_allocation:
        raise HTTPException(
            status_code=400,
            detail=f"Requested allocation {max_alloc} exceeds tier limit {tier.max_allocation}",
        )
    symbols = preferences.get("symbols_whitelist") or SYSTEM_BOT.universes[:3]
    if not isinstance(symbols, list) or not symbols:
        raise HTTPException(status_code=400, detail="symbols_whitelist must be a non-empty list")
    for symbol in symbols:
        if symbol not in SYSTEM_BOT.universes:
            raise HTTPException(status_code=400, detail=f"Symbol {symbol} is not supported by the system bot")

    notification_level = preferences.get("notification_level", "summary")
    if notification_level not in ("silent", "summary", "verbose"):
        raise HTTPException(status_code=400, detail="notification_level invalid")

    explanation_level = preferences.get("explanation_level", "concise")
    if explanation_level not in ("concise", "detailed"):
        raise HTTPException(status_code=400, detail="explanation_level invalid")

    return UserPreferences(
        max_allocation=max_alloc,
        symbols_whitelist=[str(s) for s in symbols],
        notification_level=notification_level, 
        explanation_level=explanation_level,
    )


@router.get("/bot")
async def get_system_bot() -> dict[str, Any]:
    """Return descriptor for the single system-owned trading bot."""

    return asdict(SYSTEM_BOT)


@router.get("/tiers")
async def list_tiers() -> list[dict[str, Any]]:
    """Return the tier catalog so clients can gate UX accordingly."""

    return [asdict(tier) for tier in TIERS.values()]


def _assert_profile_access(requestor: SessionUser, target_user: str) -> None:
    if requestor.user_id == target_user:
        return
    if "admin" in requestor.roles:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/users/me/profile")
async def get_my_profile(user: SessionUser = Depends(get_current_user)) -> dict[str, Any]:
    profile = _get_or_create_profile(user.user_id)
    return profile.to_dict()


@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: str, user: SessionUser = Depends(get_current_user)) -> dict[str, Any]:
    """Fetch the user's tier and preferences (auto-provisioned if missing)."""

    _assert_profile_access(user, user_id)
    profile = _get_or_create_profile(user_id)
    return profile.to_dict()


@router.post("/users/me/profile")
async def update_my_profile(payload: dict[str, Any], user: SessionUser = Depends(get_current_user)) -> dict[str, Any]:
    return await update_user_profile(user.user_id, payload, user)


@router.post("/users/{user_id}/profile")
async def update_user_profile(
    user_id: str,
    payload: dict[str, Any],
    user: SessionUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Update tier (if permitted) and/or preferences for a user.

    NOTE: Access control is not enforced here; upstream services are expected to
    ensure only privileged operators can elevate a tier.
    """
    _assert_profile_access(user, user_id)
    profile = _get_or_create_profile(user_id)
    tier_id = payload.get("tier", profile.tier)
    if tier_id not in TIERS:
        raise HTTPException(status_code=400, detail="Tier not recognized")
    if tier_id != profile.tier and "admin" not in user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tier changes require admin role")

    pref_payload = payload.get("preferences", {})
    preferences = _validate_preferences(tier_id, pref_payload)

    profile.tier = tier_id
    profile.preferences = preferences
    profile.updated_at = time.time()
    _USER_PROFILES[user_id] = profile
    return profile.to_dict()
