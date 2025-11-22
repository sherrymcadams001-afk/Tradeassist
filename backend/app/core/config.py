"""Runtime configuration for VERIDIAN backend services."""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized environment configuration."""

    app_name: str = Field(default="VERIDIAN")
    environment: Literal["local", "staging", "production"] = Field(default="local")

    backend_base_url: str = Field(default="http://localhost:8000", description="Public URL for backend callbacks")
    frontend_origin: str = Field(default="http://localhost:5173", description="Allowed frontend origin for CORS")

    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_stream_key: str = Field(default="veridian:ticks")
    redis_stream_maxlen: int = Field(default=2048)

    celery_broker_url: str = Field(default="redis://localhost:6379/1")
    celery_result_backend: str = Field(default="redis://localhost:6379/1")

    default_symbols: list[str] = Field(
        default_factory=lambda: ["BTC/USDT", "ETH/USDT"],
        description="Symbols tracked out of the box to prime the UI.",
    )

    auth0_domain: str = Field(default="", description="Auth0 tenant domain (e.g. example.us.auth0.com)")
    auth0_client_id: str = Field(default="", description="Auth0 application client id")
    auth0_client_secret: str = Field(default="", description="Auth0 application client secret")
    auth0_audience: str = Field(default="", description="Auth0 API audience for issued access tokens")
    auth0_roles_claim: str = Field(default="https://veridian.ai/roles", description="JWT claim containing role list")

    session_cookie_name: str = Field(default="veridian_session")
    session_secret: str = Field(default="dev-session-secret", description="Signer secret for session cookies")
    session_ttl_seconds: int = Field(default=3600)
    auth_state_ttl_seconds: int = Field(default=300)

    encryption_key: str = Field(
        default="",
        description="Fernet key (base64 URL-safe) for encrypting API secrets; auto-generated if blank",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


settings = get_settings()

__all__ = ["Settings", "settings", "get_settings"]
