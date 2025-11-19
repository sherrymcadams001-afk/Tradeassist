"""Runtime configuration for VERIDIAN backend services."""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized environment configuration."""

    app_name: str = Field(default="VERIDIAN")
    environment: Literal["local", "staging", "production"] = Field(default="local")

    redis_url: str = Field(default="redis://localhost:6379/0")
    redis_stream_key: str = Field(default="veridian:ticks")
    redis_stream_maxlen: int = Field(default=2048)

    celery_broker_url: str = Field(default="redis://localhost:6379/1")
    celery_result_backend: str = Field(default="redis://localhost:6379/1")

    default_symbols: list[str] = Field(
        default_factory=lambda: ["BTC/USDT", "ETH/USDT"],
        description="Symbols tracked out of the box to prime the UI.",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


settings = get_settings()

__all__ = ["Settings", "settings", "get_settings"]
