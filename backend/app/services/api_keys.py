"""Encrypted API key storage for user-owned credentials."""
from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path
from typing import Iterator, Optional

from pydantic import BaseModel, Field

from app.core.crypto import encrypt_secret

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "user_secrets.sqlite"

SCHEMA = """
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    provider TEXT NOT NULL,
    public_key TEXT NOT NULL,
    secret_encrypted TEXT NOT NULL,
    passphrase_encrypted TEXT,
    last4 TEXT NOT NULL,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
"""


class ApiKeyCreate(BaseModel):
    label: str
    provider: str
    public_key: str
    secret: str
    passphrase: str | None = None


class ApiKeyRecord(BaseModel):
    id: str
    user_id: str
    label: str
    provider: str
    public_key: str
    last4: str
    created_at: float
    updated_at: float


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def list_api_keys(user_id: str) -> list[ApiKeyRecord]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, user_id, label, provider, public_key, last4, created_at, updated_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [ApiKeyRecord(**dict(row)) for row in rows]


def create_api_key(user_id: str, payload: ApiKeyCreate) -> ApiKeyRecord:
    record_id = str(uuid.uuid4())
    now = time.time()
    last4 = payload.secret[-4:] if len(payload.secret) >= 4 else payload.secret
    secret_encrypted = encrypt_secret(payload.secret)
    passphrase_encrypted = encrypt_secret(payload.passphrase) if payload.passphrase else None
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO api_keys(id, user_id, label, provider, public_key, secret_encrypted, passphrase_encrypted, last4, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record_id,
                user_id,
                payload.label,
                payload.provider,
                payload.public_key,
                secret_encrypted,
                passphrase_encrypted,
                last4,
                now,
                now,
            ),
        )
        conn.commit()
    return ApiKeyRecord(
        id=record_id,
        user_id=user_id,
        label=payload.label,
        provider=payload.provider,
        public_key=payload.public_key,
        last4=last4,
        created_at=now,
        updated_at=now,
    )


def delete_api_key(user_id: str, key_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM api_keys WHERE id = ? AND user_id = ?", (key_id, user_id))
        conn.commit()
        return cur.rowcount > 0


__all__ = ["ApiKeyCreate", "ApiKeyRecord", "list_api_keys", "create_api_key", "delete_api_key"]