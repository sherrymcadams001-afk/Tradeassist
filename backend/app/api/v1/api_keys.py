"""User API key management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel

from app.core.security import SessionUser, get_current_user
from app.services.api_keys import ApiKeyCreate, ApiKeyRecord, create_api_key, delete_api_key, list_api_keys

router = APIRouter(prefix="/v1/api-keys", tags=["api-keys"])


class ApiKeyCreateRequest(BaseModel):
    label: str
    provider: str
    public_key: str
    secret: str
    passphrase: str | None = None


@router.get("", response_model=list[ApiKeyRecord])
def get_api_keys(user: SessionUser = Depends(get_current_user)) -> list[ApiKeyRecord]:
    return list_api_keys(user.user_id)


@router.post("", response_model=ApiKeyRecord, status_code=status.HTTP_201_CREATED)
def create_key(payload: ApiKeyCreateRequest, user: SessionUser = Depends(get_current_user)) -> ApiKeyRecord:
    record = create_api_key(user.user_id, ApiKeyCreate(**payload.model_dump()))
    return record


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_key(
    key_id: str = Path(..., description="Identifier returned when the key was created"),
    user: SessionUser = Depends(get_current_user),
) -> None:
    deleted = delete_api_key(user.user_id, key_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")