import pytest

from app.core.session import SessionData, SessionManager


@pytest.mark.asyncio
async def test_session_manager_roundtrip():
    manager = SessionManager()
    payload = SessionData(
        user_id="user-123",
        email="user@example.com",
        name="Test User",
        roles=["user"],
        access_token="token-abc",
        refresh_token="refresh-xyz",
        expires_at=999999999,
    )
    signed = await manager.create_session(payload)
    resolved = await manager.resolve_session(signed)
    assert resolved is not None
    assert resolved.user_id == payload.user_id
    assert resolved.email == payload.email

    state = await manager.issue_state("http://localhost:5173/dashboard")
    redirect = await manager.consume_state(state)
    assert redirect == "http://localhost:5173/dashboard"
    assert await manager.consume_state(state) is None

    await manager.destroy_session(signed)
    assert await manager.resolve_session(signed) is None