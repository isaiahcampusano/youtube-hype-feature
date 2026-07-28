import os
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from zoneinfo import ZoneInfo


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/hype.db")
TIMEZONE_NAME = os.getenv("TIMEZONE", "America/New_York")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class HypeEvent(Base):
    __tablename__ = "hype_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    video_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    week_key = Column(String, nullable=False, index=True)


class HypeStateResponse(BaseModel):
    userId: str
    weekKey: str
    remainingHypes: int
    hypeHistory: List[dict]
    mockPointsTotal: int
    resetTime: str


class CreateHypeRequest(BaseModel):
    userId: str = Field(min_length=1)
    videoId: str = Field(min_length=1)


app = FastAPI(title="Hype Balance Backend Prototype")


def get_timezone():
    return ZoneInfo(TIMEZONE_NAME)


def get_current_datetime(now=None):
    if now is not None:
        return now
    return datetime.now(get_timezone())


def get_week_key(now=None):
    current_time = get_current_datetime(now)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    local_time = current_time.astimezone(get_timezone())
    monday = local_time - timedelta(days=(local_time.weekday() + 6) % 7)
    return monday.strftime("%Y-%m-%d")


def get_mock_points(video_id: str) -> int:
    return {"video-001": 120, "video-002": 85, "video-004": 95, "video-005": 72}.get(video_id, 75)


def get_reset_time(now=None):
    current_time = get_current_datetime(now)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    local_time = current_time.astimezone(get_timezone())
    current_week_monday = local_time - timedelta(days=(local_time.weekday() + 6) % 7)
    next_week_monday = current_week_monday + timedelta(days=7)
    return next_week_monday.replace(hour=0, minute=0, second=0, microsecond=0)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_or_create_user_state(db, user_id: str, now=None):
    week_key = get_week_key(now)
    events = (
        db.query(HypeEvent)
        .filter(HypeEvent.user_id == user_id)
        .filter(HypeEvent.week_key == week_key)
        .order_by(HypeEvent.created_at.asc())
        .all()
    )
    mock_points_total = sum(get_mock_points(event.video_id) for event in events)
    return {
        "userId": user_id,
        "weekKey": week_key,
        "remainingHypes": max(0, 3 - len(events)),
        "hypeHistory": [
            {"videoId": event.video_id, "timestamp": event.created_at.isoformat()}
            for event in events
        ],
        "mockPointsTotal": mock_points_total,
        "resetTime": get_reset_time(now).isoformat(),
    }


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(engine)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/hype-state/{user_id}", response_model=HypeStateResponse)
def get_hype_state(user_id: str):
    db = SessionLocal()
    try:
        payload = get_or_create_user_state(db, user_id)
        return payload
    finally:
        db.close()


@app.post("/api/hypes", response_model=HypeStateResponse)
def create_hype(payload: CreateHypeRequest):
    db = SessionLocal()
    try:
        state = get_or_create_user_state(db, payload.userId)
        if state["remainingHypes"] <= 0:
            raise HTTPException(status_code=400, detail="No Hypes remaining for this week.")

        event = HypeEvent(
            user_id=payload.userId,
            video_id=payload.videoId,
            created_at=get_current_datetime(),
            week_key=state["weekKey"],
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        return get_or_create_user_state(db, payload.userId)
    except HTTPException:
        raise
    finally:
        db.close()


@app.post("/api/reset-demo")
def reset_demo():
    db = SessionLocal()
    try:
        db.query(HypeEvent).filter(HypeEvent.user_id == "demo-user").delete()
        db.commit()
        return {"status": "ok", "message": "Demo Hype data cleared."}
    finally:
        db.close()
