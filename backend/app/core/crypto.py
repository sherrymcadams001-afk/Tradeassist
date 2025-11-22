"""Symmetric crypto helpers for protecting user secrets."""
from __future__ import annotations

import base64
import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger("veridian.crypto")


def _build_fernet() -> Fernet:
    key = settings.encryption_key.strip()
    if not key:
        generated = Fernet.generate_key()
        logger.warning("No encryption key configured; generated ephemeral key (restart will invalidate data)")
        return Fernet(generated)
    try:
        # Validate base64 payload before constructing the cipher
        base64.urlsafe_b64decode(key)
    except Exception as exc:  # pragma: no cover - defensive guardrails
        raise ValueError("Invalid FERNet key configured; provide a urlsafe base64 string") from exc
    return Fernet(key.encode() if isinstance(key, str) else key)


@lru_cache(maxsize=1)
def get_cipher() -> Fernet:
    """Return a memoized Fernet cipher instance."""

    return _build_fernet()


def encrypt_secret(value: str) -> str:
    """Encrypt the provided secret with the configured cipher."""

    return get_cipher().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    """Decrypt a stored secret, raising InvalidToken on tampering."""

    return get_cipher().decrypt(value.encode()).decode()


__all__ = ["encrypt_secret", "decrypt_secret", "InvalidToken"]