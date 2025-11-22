from app.services import api_keys


def test_api_key_crud(tmp_path, monkeypatch):
    temp_db = tmp_path / "keys.sqlite"
    monkeypatch.setattr(api_keys, "DB_PATH", temp_db)
    payload = api_keys.ApiKeyCreate(
        label="Binance",
        provider="binance",
        public_key="PUB123",
        secret="SECRET-4567",
        passphrase=None,
    )

    created = api_keys.create_api_key("user-1", payload)
    assert created.public_key == payload.public_key
    assert created.last4 == "4567"

    keys = api_keys.list_api_keys("user-1")
    assert len(keys) == 1
    assert keys[0].id == created.id

    deleted = api_keys.delete_api_key("user-1", created.id)
    assert deleted is True
    assert api_keys.list_api_keys("user-1") == []