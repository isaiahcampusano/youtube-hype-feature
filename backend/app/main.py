import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/hype.db")
DEFAULT_TIMEZONE = os.getenv("TIMEZONE", "America/New_York")
EXPERIMENT_ENABLED = os.getenv("HYPE_EXPERIMENT_ENABLED", "true").lower() == "true"
UNDO_OVERRIDE = os.getenv("HYPE_UNDO_ENABLED")
BADGES_OVERRIDE = os.getenv("HYPE_BADGES_ENABLED")
WEEKEND_BONUS_MODE = os.getenv("HYPE_WEEKEND_BONUS_MODE", "unlimited")
BASE_QUOTA = int(os.getenv("HYPE_BASE_QUOTA", "3"))
EXPERIMENT_GROUPS = ("control", "weekend_bonus", "undo", "weekend_bonus_undo", "badges")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(String, primary_key=True)
    quota_schedule = Column(String, nullable=False, default="default")
    experiment_group = Column(String, nullable=False, default="control")
    timezone_name = Column(String, nullable=False, default=DEFAULT_TIMEZONE)
    created_at = Column(DateTime(timezone=True), nullable=False)


class HypeEvent(Base):
    __tablename__ = "hype_events"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_hype_idempotency"),
        UniqueConstraint("user_id", "video_id", "period_key", name="uq_hype_video_per_period"),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    video_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)
    period_key = Column(String, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    undo_expires_at = Column(DateTime(timezone=True), nullable=False)
    idempotency_key = Column(String, nullable=True)
    reassigned_from_id = Column(Integer, nullable=True)


class Badge(Base):
    __tablename__ = "badges"
    slug = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_slug", name="uq_user_badge"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    badge_slug = Column(String, ForeignKey("badges.slug"), nullable=False)
    awarded_at = Column(DateTime(timezone=True), nullable=False)


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    experiment_group = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False)


class FeedbackResponse(Base):
    __tablename__ = "feedback_responses"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    video_id = Column(String, nullable=False)
    reasons_json = Column(Text, nullable=False)
    additional_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


class CreateHypeRequest(BaseModel):
    userId: str = Field(min_length=1)
    videoId: str = Field(min_length=1)
    timezone: str = DEFAULT_TIMEZONE
    idempotencyKey: Optional[str] = None


class EventRequest(BaseModel):
    userId: str = Field(min_length=1)
    eventId: int


class ReassignRequest(EventRequest):
    videoId: str = Field(min_length=1)
    idempotencyKey: Optional[str] = None


class FeedbackRequest(BaseModel):
    userId: str = Field(min_length=1)
    videoId: str = Field(min_length=1)
    reasons: list[str] = Field(min_length=1, max_length=4)
    additionalFeedback: Optional[str] = Field(default=None, max_length=500)


app = FastAPI(title="Hype Balance Prototype API", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def valid_timezone(name: str) -> str:
    try:
        ZoneInfo(name)
        return name
    except ZoneInfoNotFoundError:
        return DEFAULT_TIMEZONE


def assignment_for(user_id: str) -> str:
    if not EXPERIMENT_ENABLED:
        return "control"
    bucket = int(hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:8], 16)
    return EXPERIMENT_GROUPS[bucket % len(EXPERIMENT_GROUPS)]


def bool_override(value: Optional[str], fallback: bool) -> bool:
    return fallback if value is None else value.lower() == "true"


def experiment_config(settings: UserSettings) -> dict:
    group = settings.experiment_group
    return {
        "group": group,
        "quotaSchedule": settings.quota_schedule,
        "undoEnabled": bool_override(UNDO_OVERRIDE, group in {"undo", "weekend_bonus_undo"}),
        "badgesEnabled": bool_override(BADGES_OVERRIDE, group == "badges"),
        "weekendBonusMode": WEEKEND_BONUS_MODE,
    }


def log_event(db, settings: UserSettings, name: str):
    db.add(AnalyticsEvent(user_id=settings.user_id, name=name, experiment_group=settings.experiment_group, created_at=utc_now()))


def get_or_create_settings(db, user_id: str, timezone_name: Optional[str] = None) -> UserSettings:
    settings = db.get(UserSettings, user_id)
    if settings:
        if timezone_name and settings.timezone_name != valid_timezone(timezone_name):
            settings.timezone_name = valid_timezone(timezone_name)
            db.commit()
        return settings
    group = assignment_for(user_id)
    settings = UserSettings(
        user_id=user_id,
        experiment_group=group,
        quota_schedule="weekend_bonus" if group in {"weekend_bonus", "weekend_bonus_undo"} else "default",
        timezone_name=valid_timezone(timezone_name or DEFAULT_TIMEZONE),
        created_at=utc_now(),
    )
    db.add(settings)
    log_event(db, settings, "experiment_assigned")
    try:
        db.commit()
        return settings
    except IntegrityError:
        # Parallel first-load requests may race to create the same stable assignment.
        # The primary key is authoritative; use the row committed by the winner.
        db.rollback()
        return db.get(UserSettings, user_id)


def local_now(settings: UserSettings, now: Optional[datetime] = None) -> datetime:
    return as_utc(now or utc_now()).astimezone(ZoneInfo(settings.timezone_name))


def period_start(settings: UserSettings, now: Optional[datetime] = None) -> datetime:
    current = local_now(settings, now)
    anchor_weekday = 4 if settings.quota_schedule == "weekend_bonus" else 0
    start = current - timedelta(days=(current.weekday() - anchor_weekday) % 7)
    return start.replace(hour=0, minute=0, second=0, microsecond=0)


def get_reset_time(settings: UserSettings, now: Optional[datetime] = None) -> datetime:
    return period_start(settings, now) + timedelta(days=7)


def quota_limit(settings: UserSettings, now: Optional[datetime] = None) -> Optional[int]:
    current = local_now(settings, now)
    if settings.quota_schedule == "weekend_bonus" and current.weekday() >= 4:
        return None if WEEKEND_BONUS_MODE == "unlimited" else BASE_QUOTA + 3
    return BASE_QUOTA


def active_events(db, settings: UserSettings, now: Optional[datetime] = None):
    key = period_start(settings, now).date().isoformat()
    return db.query(HypeEvent).filter(
        HypeEvent.user_id == settings.user_id,
        HypeEvent.period_key == key,
        HypeEvent.is_active.is_(True),
    ).order_by(HypeEvent.created_at.asc()).all()


def video_already_hyped(db, settings: UserSettings, video_id: str, now: Optional[datetime] = None) -> bool:
    key = period_start(settings, now).date().isoformat()
    return db.query(HypeEvent).filter_by(
        user_id=settings.user_id, video_id=video_id, period_key=key
    ).first() is not None


def serialize_event(event: HypeEvent, now: Optional[datetime] = None) -> dict:
    current = as_utc(now or utc_now())
    expiry = as_utc(event.undo_expires_at)
    return {
        "eventId": event.id,
        "videoId": event.video_id,
        "timestamp": as_utc(event.created_at).isoformat(),
        "isActive": event.is_active,
        "undoExpiresAt": expiry.isoformat(),
        "undoRemainingSeconds": max(0, int((expiry - current).total_seconds())),
        "canUndo": bool(event.is_active and current < expiry),
    }


def award_badges(db, settings: UserSettings):
    if not experiment_config(settings)["badgesEnabled"]:
        return
    active = db.query(HypeEvent).filter(HypeEvent.user_id == settings.user_id, HypeEvent.is_active.is_(True)).all()
    candidates = []
    if len(active) >= 10:
        candidates.append("supporter")
    if len({event.video_id for event in active}) >= 3:
        candidates.append("community-builder")
    if any(event.video_id in {"video-001", "video-004"} for event in active):
        candidates.append("trendspotter")
    for slug in candidates:
        exists = db.query(UserBadge).filter_by(user_id=settings.user_id, badge_slug=slug).first()
        if not exists:
            db.add(UserBadge(user_id=settings.user_id, badge_slug=slug, awarded_at=utc_now()))
            log_event(db, settings, "badge_awarded")


def state_payload(db, settings: UserSettings, now: Optional[datetime] = None) -> dict:
    events = active_events(db, settings, now)
    limit = quota_limit(settings, now)
    remaining = None if limit is None else max(0, limit - len(events))
    return {
        "userId": settings.user_id,
        "periodKey": period_start(settings, now).date().isoformat(),
        "remainingHypes": remaining,
        "unlimitedHypes": limit is None,
        "hypeHistory": [serialize_event(event, now) for event in events],
        "mockPointsTotal": sum({"video-001": 120, "video-002": 85, "video-004": 95, "video-005": 72}.get(event.video_id, 75) for event in events),
        "resetTime": get_reset_time(settings, now).isoformat(),
        "timezone": settings.timezone_name,
        "experiment": experiment_config(settings),
    }


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for slug, name, description in (
            ("supporter", "Supporter", "Used 10 Hypes to lift up emerging creators."),
            ("community-builder", "Community Builder", "Supported at least 3 different creators."),
            ("trendspotter", "Trendspotter", "Hyped a video that reached the prototype leaderboard."),
        ):
            if not db.get(Badge, slug):
                db.add(Badge(slug=slug, name=name, description=description))
        db.commit()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/hype-state/{user_id}")
def get_hype_state(user_id: str, timezone_name: str = Query(DEFAULT_TIMEZONE, alias="timezone")):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, user_id, timezone_name)
        return state_payload(db, settings)


@app.post("/api/hypes")
def create_hype(payload: CreateHypeRequest):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, payload.userId, payload.timezone)
        if payload.idempotencyKey:
            existing = db.query(HypeEvent).filter_by(user_id=payload.userId, idempotency_key=payload.idempotencyKey).first()
            if existing:
                return state_payload(db, settings)
        if video_already_hyped(db, settings, payload.videoId):
            raise HTTPException(status_code=409, detail={
                "code": "already_hyped",
                "message": "You already hyped this video in the current quota period.",
            })
        events = active_events(db, settings)
        limit = quota_limit(settings)
        if limit is not None and len(events) >= limit:
            raise HTTPException(status_code=409, detail="No Hypes remaining in this quota period.")
        now = utc_now()
        db.add(HypeEvent(
            user_id=payload.userId, video_id=payload.videoId, created_at=now,
            period_key=period_start(settings, now).date().isoformat(), is_active=True,
            undo_expires_at=now + timedelta(hours=24), idempotency_key=payload.idempotencyKey,
        ))
        log_event(db, settings, "hype_created")
        try:
            db.flush()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(status_code=409, detail={
                "code": "already_hyped",
                "message": "You already hyped this video in the current quota period.",
            }) from error
        award_badges(db, settings)
        db.commit()
        return state_payload(db, settings)


@app.get("/api/hype/queue")
def get_hype_queue(userId: str):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, userId)
        key = period_start(settings).date().isoformat()
        events = db.query(HypeEvent).filter_by(user_id=userId, period_key=key).order_by(HypeEvent.created_at.desc()).all()
        return {"items": [serialize_event(event) for event in events], "undoEnabled": experiment_config(settings)["undoEnabled"]}


@app.post("/api/hype/undo")
def undo_hype(payload: EventRequest):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, payload.userId)
        if not experiment_config(settings)["undoEnabled"]:
            raise HTTPException(status_code=403, detail="Undo is not enabled for this experiment group.")
        event = db.get(HypeEvent, payload.eventId)
        if not event or event.user_id != payload.userId:
            raise HTTPException(status_code=404, detail="Hype event not found.")
        if not event.is_active:
            raise HTTPException(status_code=409, detail="Hype has already been undone.")
        if utc_now() >= as_utc(event.undo_expires_at):
            raise HTTPException(status_code=410, detail="The 24-hour undo window has expired.")
        event.is_active = False
        log_event(db, settings, "hype_undone")
        db.commit()
        return state_payload(db, settings)


@app.post("/api/hype/reassign")
def reassign_hype(payload: ReassignRequest):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, payload.userId)
        old_event = db.get(HypeEvent, payload.eventId)
        if not old_event or old_event.user_id != payload.userId:
            raise HTTPException(status_code=404, detail="Original Hype event not found.")
        if old_event.is_active:
            raise HTTPException(status_code=409, detail="Undo the original Hype before reassigning it.")
        if payload.idempotencyKey:
            existing = db.query(HypeEvent).filter_by(user_id=payload.userId, idempotency_key=payload.idempotencyKey).first()
            if existing:
                return state_payload(db, settings)
        if video_already_hyped(db, settings, payload.videoId):
            raise HTTPException(status_code=409, detail={
                "code": "already_hyped",
                "message": "Choose a video you have not hyped in this quota period.",
            })
        events = active_events(db, settings)
        limit = quota_limit(settings)
        if limit is not None and len(events) >= limit:
            raise HTTPException(status_code=409, detail="No quota is available for reassignment.")
        now = utc_now()
        db.add(HypeEvent(
            user_id=payload.userId, video_id=payload.videoId, created_at=now,
            period_key=period_start(settings, now).date().isoformat(), is_active=True,
            undo_expires_at=now + timedelta(hours=24), idempotency_key=payload.idempotencyKey,
            reassigned_from_id=old_event.id,
        ))
        log_event(db, settings, "hype_reassigned")
        db.flush()
        award_badges(db, settings)
        db.commit()
        return state_payload(db, settings)


@app.post("/api/feedback", status_code=201)
def create_feedback(payload: FeedbackRequest):
    allowed_reasons = {
        "Loved the content",
        "Supporting a small creator",
        "Quality was exceptional",
        "Other",
    }
    if any(reason not in allowed_reasons for reason in payload.reasons):
        raise HTTPException(status_code=422, detail="One or more feedback reasons are invalid.")
    with SessionLocal() as db:
        settings = get_or_create_settings(db, payload.userId)
        response = FeedbackResponse(
            user_id=payload.userId,
            video_id=payload.videoId,
            reasons_json=json.dumps(payload.reasons),
            additional_feedback=(payload.additionalFeedback or "").strip() or None,
            created_at=utc_now(),
        )
        db.add(response)
        log_event(db, settings, "feedback_submitted")
        db.commit()
        return {"status": "recorded", "feedbackId": response.id}


@app.get("/api/badges")
def get_badges(userId: str):
    with SessionLocal() as db:
        settings = get_or_create_settings(db, userId)
        rows = db.query(UserBadge, Badge).join(Badge, UserBadge.badge_slug == Badge.slug).filter(UserBadge.user_id == userId).all()
        return {"enabled": experiment_config(settings)["badgesEnabled"], "items": [
            {"slug": badge.slug, "name": badge.name, "description": badge.description, "awardedAt": as_utc(user_badge.awarded_at).isoformat()}
            for user_badge, badge in rows
        ]}


@app.post("/api/reset-demo")
def reset_demo():
    with SessionLocal() as db:
        db.query(HypeEvent).filter(HypeEvent.user_id == "demo-user").delete()
        db.query(UserBadge).filter(UserBadge.user_id == "demo-user").delete()
        db.query(AnalyticsEvent).filter(AnalyticsEvent.user_id == "demo-user").delete()
        db.query(FeedbackResponse).filter(FeedbackResponse.user_id == "demo-user").delete()
        db.commit()
        return {"status": "ok", "message": "Demo Hype data cleared."}
