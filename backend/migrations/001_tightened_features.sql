-- Reference migration for deployments upgrading from the original prototype.
-- SQLite requires rebuilding hype_events to remove/rename the legacy week_key column;
-- production deployments should run the equivalent operation through Alembic.
CREATE TABLE user_settings (
  user_id VARCHAR PRIMARY KEY,
  quota_schedule VARCHAR NOT NULL DEFAULT 'default',
  experiment_group VARCHAR NOT NULL DEFAULT 'control',
  timezone_name VARCHAR NOT NULL DEFAULT 'America/New_York',
  created_at DATETIME NOT NULL
);

ALTER TABLE hype_events RENAME COLUMN week_key TO period_key;
ALTER TABLE hype_events ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE hype_events ADD COLUMN undo_expires_at DATETIME;
ALTER TABLE hype_events ADD COLUMN idempotency_key VARCHAR;
ALTER TABLE hype_events ADD COLUMN reassigned_from_id INTEGER;
CREATE UNIQUE INDEX uq_hype_idempotency ON hype_events(user_id, idempotency_key);
CREATE UNIQUE INDEX uq_hype_video_per_period ON hype_events(user_id, video_id, period_key);

CREATE TABLE badges (slug VARCHAR PRIMARY KEY, name VARCHAR NOT NULL, description VARCHAR NOT NULL);
CREATE TABLE user_badges (
  id INTEGER PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  badge_slug VARCHAR NOT NULL REFERENCES badges(slug),
  awarded_at DATETIME NOT NULL,
  UNIQUE(user_id, badge_slug)
);
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  experiment_group VARCHAR NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE feedback_responses (
  id INTEGER PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  video_id VARCHAR NOT NULL,
  reasons_json TEXT NOT NULL,
  additional_feedback TEXT,
  created_at DATETIME NOT NULL
);
