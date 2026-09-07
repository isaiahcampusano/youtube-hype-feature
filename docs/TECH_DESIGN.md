# Hype technical design

## Architecture and authority

The FastAPI service is the source of truth for quota, experiment assignment, Hype state, undo eligibility, and badges. The browser store is an offline prototype fallback only. Production clients must not grant quota based on local state because local clocks and storage are user-controlled and cross-device changes would conflict.

## Data model

- `user_settings`: stable experiment group, quota schedule, IANA timezone, creation time.
- `hype_events`: immutable allocation identity and timestamps plus soft-delete state, undo expiry, idempotency key, and reassignment lineage.
- `badges`: badge definitions.
- `user_badges`: unique user/badge awards.
- `analytics_events`: assignment and action event names with group and server timestamp.

The checked-in SQL is a reference migration. A production database should use a reviewed Alembic migration, backfill `undo_expires_at`, and validate rows before making the column non-null.

## Quota schedules and timezone handling

Store an IANA timezone such as `America/New_York`, not a fixed UTC offset, so daylight-saving changes are correct. Convert the server’s UTC timestamp into the saved zone, calculate the local Monday or Friday midnight period boundary, and store a stable period key. If the client sends an invalid zone, fall back to the configured default and emit a data-quality metric. Account timezone changes should take effect at the next period boundary in production to prevent reset shopping.

Friday Weekend Bonus is environment-configurable as `unlimited` or `extra_3`. The response uses `remainingHypes: null` plus `unlimitedHypes: true` rather than a magic large number.

## API behavior

| Endpoint | Purpose | Important responses |
|---|---|---|
| `GET /api/hype-state/{user_id}` | Balance, reset, active history, treatment | 200 |
| `POST /api/hypes` | Allocate a Hype | 200, 409 exhausted |
| `GET /api/hype/queue` | Active and undone events for the period | 200 |
| `POST /api/hype/undo` | Soft-delete within 24 hours | 200, 403 disabled, 410 expired |
| `POST /api/hype/reassign` | Allocate after undo | 200, 409 invalid state/quota |
| `GET /api/badges` | Earned badges and visibility | 200 |

The prototype identifies the user in the body/query for simplicity. Production must derive the user from an authenticated session and reject mismatched identifiers.

## Duplicate prevention

The client sends a unique idempotency key for Hype and reassign commands. A unique `(user_id, idempotency_key)` index makes retries return the already-resulting state. Production should retain keys at least as long as request retries are plausible, return the original response body, and reject reuse with a different payload hash.

## Concurrency

The prototype performs count/check/write in one session and has a uniqueness constraint for request replay. For production, wrap quota mutation in a database transaction and either:

1. Lock the user-period quota row with `SELECT … FOR UPDATE`, then count and insert; or
2. Atomically increment a versioned counter with `used < limit`, retrying on optimistic-lock conflicts.

Undo and reassign should compare the expected event version in the same transaction. SQLite is suitable for the demo, not for high-contention quota enforcement.

## Coordinated manipulation

Record server-side account, device, coarse IP prefix, creator, video, and timing signals under an approved privacy policy. Detect bursts from related accounts, repeated device/account fan-out, synchronized targeting, abnormal undo cycling, and concentration on a creator. Apply layered rate limits, delay suspicious leaderboard credit, and route high-risk clusters to integrity review. Never make IP address alone dispositive.

## Data retention

- Idempotency and operational logs: 30 days unless incident retention applies.
- Raw integrity signals: shortest period that supports abuse investigation, proposed 90 days subject to privacy review.
- Hype events: retain active product history for 13 months, then aggregate or delete.
- Experiment assignments and de-identified metrics: retain through analysis plus audit window, proposed 18 months.
- User deletion: remove direct identifiers and queued history within the published SLA; invalidate derived badges where required.

These are proposed policies, not legal conclusions. Privacy and counsel must approve before launch.

## Public visibility

Individual viewer queue, undo state, assignment, and badge earning time are private. Public surfaces may show aggregate video Hype totals and leaderboard placement only after integrity filtering and minimum aggregation thresholds. Creator analytics may receive aggregates, not lists of viewers, unless explicit consent and policy permit it.

## Scaling quota checks

Keep the authoritative mutation in the regional primary datastore. Cache read-only balance responses by user and period for a few seconds, invalidating on mutation. Do not enforce quota at a CDN edge without an atomic reservation protocol. Partition events by user hash and time, index `(user_id, period_key, is_active)`, and use a compact user-period counter at scale. Polling is adequate for the prototype; production can push invalidation through a session event stream for cross-device freshness.

## Leaderboard updates

Accept Hype events in near real time, but compute public leaderboard scores in one- to five-minute micro-batches after integrity filtering. This bounds manipulation exposure and avoids a costly synchronous ranking write. Product surfaces should disclose that totals may take a few minutes to update. Badges triggered by leaderboard outcomes should consume the filtered leaderboard event, not raw Hype volume.

## Feature flags and rollback

`HYPE_EXPERIMENT_ENABLED`, `HYPE_UNDO_ENABLED`, `HYPE_BADGES_ENABLED`, `HYPE_WEEKEND_BONUS_MODE`, and `HYPE_BASE_QUOTA` control the prototype. Production flags should be remotely configurable, audited, and evaluated server-side. A kill switch must disable new undo/reassign actions without corrupting existing events; existing restored quota should remain internally consistent.

## Observability and test plan

Log assignment once and every created, undone, reassigned, and awarded event. Dashboards segment success/conflict/latency by group and local period day. Alert on quota over-allocation, idempotency conflicts, integrity spikes, and assignment imbalance.

Automated tests cover Monday reset, timezone-aware Friday reset, unlimited weekend behavior, quota exhaustion, idempotent retry, undo/reassign, expiry, badges, and deterministic assignment. Add database-specific concurrency tests, authentication tests, migration/backfill tests, and load tests before production. Manual UI checks live in `tests/manual-test-checklist.md`.
