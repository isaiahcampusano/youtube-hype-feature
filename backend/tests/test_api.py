import importlib
import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    db_path = tmp_path / "hype-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")

    import backend.app.main as main

    importlib.reload(main)
    main.Base.metadata.drop_all(main.engine)
    main.Base.metadata.create_all(main.engine)

    return TestClient(main.app)


def test_weekly_reset_restores_balance(client, monkeypatch):
    monkeypatch.setattr("backend.app.main.get_current_datetime", lambda now=None: datetime(2026, 7, 27, 12, 0, tzinfo=timezone.utc))

    first = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-001"})
    second = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-001"})
    third = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-002"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 200

    state = client.get("/api/hype-state/demo-user")
    assert state.json()["remainingHypes"] == 0
    assert len(state.json()["hypeHistory"]) == 3

    monkeypatch.setattr("backend.app.main.get_current_datetime", lambda now=None: datetime(2026, 8, 3, 12, 0, tzinfo=timezone.utc))

    reset_state = client.get("/api/hype-state/demo-user")
    assert reset_state.status_code == 200
    assert reset_state.json()["remainingHypes"] == 3
    assert reset_state.json()["hypeHistory"] == []


def test_repeat_hypes_are_allowed_on_same_video(client):
    first = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-001"})
    second = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-001"})

    assert first.status_code == 200
    assert second.status_code == 200

    state = client.get("/api/hype-state/demo-user")
    payload = state.json()
    assert payload["remainingHypes"] == 1
    assert len(payload["hypeHistory"]) == 2
    assert payload["hypeHistory"][0]["videoId"] == "video-001"
    assert payload["hypeHistory"][1]["videoId"] == "video-001"


def test_zero_balance_blocks_new_hypes(client):
    for video_id in ["video-001", "video-002", "video-003"]:
        response = client.post("/api/hypes", json={"userId": "demo-user", "videoId": video_id})
        assert response.status_code == 200

    blocked = client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-004"})

    assert blocked.status_code == 400
    assert blocked.json()["detail"] == "No Hypes remaining for this week."

    state = client.get("/api/hype-state/demo-user")
    payload = state.json()
    assert payload["remainingHypes"] == 0
    assert len(payload["hypeHistory"]) == 3


def test_reset_demo_restores_default_balance(client):
    client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-001"})
    client.post("/api/hypes", json={"userId": "demo-user", "videoId": "video-002"})

    reset = client.post("/api/reset-demo")
    assert reset.status_code == 200

    state = client.get("/api/hype-state/demo-user")
    payload = state.json()
    assert payload["remainingHypes"] == 3
    assert payload["hypeHistory"] == []
