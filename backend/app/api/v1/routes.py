"""FastAPI surface for VERIDIAN control plane."""
from fastapi import APIRouter, Depends

from app.core.config import settings

router = APIRouter(prefix="/v1", tags=["veridian"])


@router.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}
