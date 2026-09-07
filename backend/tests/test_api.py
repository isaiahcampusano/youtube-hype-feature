import importlib
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def api(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'hype-test.db'}")
    monkeypatch.setenv("HYPE_EXPERIMENT_ENABLED", "false")
    monkeypatch.setenv("HYPE_UNDO_ENABLED", "true")
    monkeypatch.setenv("HYPE_BADGES_ENABLED", "true")
    import backend.app.main as main
    importlib.reload(main)
    with TestClient(main.app) as client:
        yield client, main


def create_hype(client, video="video-001", key=None):
    return client.post("/api/hypes", json={
        "userId": "demo-user", "videoId": video, "timezone": "UTC", "idempotencyKey": key,
    })


def test_monday_quota_reset_and_persistent_state(api, monkeypatch):
    client, main = api
    monkeypatch.setattr(main, "utc_now", lambda: datetime(2026, 7, 27, 12, tzinfo=timezone.utc))
    for video in ("video-001", "video-002", "video-004"):
        assert create_hype(client, video).status_code == 200
    assert create_hype(client, "video-005").status_code == 409
    assert client.get("/api/hype-state/demo-user?timezone=UTC").json()["remainingHypes"] == 0
    monkeypatch.setattr(main, "utc_now", lambda: datetime(2026, 8, 3, 12, tzinfo=timezone.utc))
    reset = client.get("/api/hype-state/demo-user?timezone=UTC").json()
    assert reset["remainingHypes"] == 3
    assert reset["hypeHistory"] == []


def test_idempotency_prevents_duplicate_hype(api):
    client, _ = api
    first = create_hype(client, key="same-request")
    retry = create_hype(client, key="same-request")
    assert first.status_code == retry.status_code == 200
    assert len(retry.json()["hypeHistory"]) == 1


def test_undo_restores_quota_and_reassigns(api):
    client, _ = api
    event_id = create_hype(client, "video-001").json()["hypeHistory"][0]["eventId"]
    assert client.get("/api/hype/queue?userId=demo-user").json()["items"][0]["canUndo"] is True
    undone = client.post("/api/hype/undo", json={"userId": "demo-user", "eventId": event_id})
    assert undone.status_code == 200
    assert undone.json()["remainingHypes"] == 3
    reassigned = client.post("/api/hype/reassign", json={
        "userId": "demo-user", "eventId": event_id, "videoId": "video-002", "idempotencyKey": "reassign-1",
    })
    assert reassigned.status_code == 200
    assert reassigned.json()["remainingHypes"] == 2
    assert reassigned.json()["hypeHistory"][0]["videoId"] == "video-002"


def test_expired_hype_cannot_be_undone(api, monkeypatch):
    client, main = api
    created_at = datetime(2026, 7, 27, 12, tzinfo=timezone.utc)
    monkeypatch.setattr(main, "utc_now", lambda: created_at)
    event_id = create_hype(client).json()["hypeHistory"][0]["eventId"]
    monkeypatch.setattr(main, "utc_now", lambda: datetime(2026, 7, 28, 12, 0, 1, tzinfo=timezone.utc))
    response = client.post("/api/hype/undo", json={"userId": "demo-user", "eventId": event_id})
    assert response.status_code == 410


def test_weekend_schedule_is_timezone_aware_and_unlimited(api, monkeypatch):
    client, main = api
    with main.SessionLocal() as db:
        settings = main.get_or_create_settings(db, "weekend-user", "America/Los_Angeles")
        settings.quota_schedule = "weekend_bonus"
        settings.experiment_group = "weekend_bonus"
        db.commit()
    monkeypatch.setattr(main, "utc_now", lambda: datetime(2026, 7, 31, 20, tzinfo=timezone.utc))
    state = client.get("/api/hype-state/weekend-user?timezone=America%2FLos_Angeles").json()
    assert state["unlimitedHypes"] is True
    assert state["remainingHypes"] is None
    assert state["resetTime"].startswith("2026-08-07T00:00:00")


def test_badges_are_awarded_and_exposed(api):
    client, _ = api
    for video in ("video-001", "video-002", "video-004"):
        assert create_hype(client, video).status_code == 200
    badges = client.get("/api/badges?userId=demo-user").json()
    assert badges["enabled"] is True
    assert {item["slug"] for item in badges["items"]} == {"community-builder", "trendspotter"}


def test_deterministic_experiment_assignment(api):
    _, main = api
    original = main.EXPERIMENT_ENABLED
    main.EXPERIMENT_ENABLED = True
    try:
        assert main.assignment_for("stable-user") == main.assignment_for("stable-user")
        assert main.assignment_for("stable-user") in main.EXPERIMENT_GROUPS
    finally:
        main.EXPERIMENT_ENABLED = original


def test_parallel_first_load_creates_one_assignment(api):
    client, main = api
    with ThreadPoolExecutor(max_workers=3) as pool:
        responses = list(pool.map(lambda path: client.get(path), [
            "/api/hype-state/race-user?timezone=UTC",
            "/api/hype/queue?userId=race-user",
            "/api/badges?userId=race-user",
        ]))
    assert all(response.status_code == 200 for response in responses)
    with main.SessionLocal() as db:
        assert db.query(main.UserSettings).filter_by(user_id="race-user").count() == 1
