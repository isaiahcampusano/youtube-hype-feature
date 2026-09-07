# Hype clarity and control PRD

## Problem statement

Viewers have a scarce weekly Hype allowance but lack persistent visibility, a clear reset date, and a way to recover from an allocation they regret. That uncertainty can produce surprise, hesitation, and low-quality allocations. The product should make the allowance legible and forgiving without changing video recommendations or promising creator outcomes.

## Target users and current behavior

The primary target is a viewer who wants to support emerging creators and watches at least several eligible videos per week. Secondary users are emerging creators and high-frequency viewers. Today’s prototype grants three Hypes in a Monday-anchored period, reveals balance mainly after an action, and does not provide undo, history management, experiments, or rewards.

## Product principles

- Make scarcity visible before the decision.
- State dates in the viewer’s timezone.
- Make recovery clear, time-bounded, and reversible.
- Reward authentic support without turning Hype into a game of volume.
- Enforce authoritative rules on the server.

## Proposed experience

The feed and Hype control always show remaining allowance and the exact reset date. Eligible experiment groups may undo an active Hype for 24 hours; undo immediately restores one unit, and the queue offers reassignment to an eligible video. A profile experiment notice explains the assigned schedule. A minimal achievements section shows Supporter, Community Builder, and Trendspotter progress. All visuals are fictional and generic.

Weekend Bonus has two configurable modes: unlimited Hypes Friday through Sunday, or three additional Hypes. The prototype defaults to unlimited. Monday and Friday boundaries are midnight in the saved IANA timezone.

## User stories and acceptance

### Persistent balance

- As a viewer, I can see my remaining Hypes before opening a video.
- As a viewer, I can see a localized reset date wherever the balance appears.
- Unlimited periods render as “∞” and never disable the Hype action.

### Queue, undo, and reassignment

- As a treatment user, I can see this period’s Hype events and each remaining undo window.
- I can undo an active Hype until 24 hours after creation; after expiration the action is disabled.
- Undo restores quota immediately. I can reassign that capacity to another eligible video.
- Retries with the same idempotency key do not create duplicate Hypes.

### Schedule experiment

- Assignment is deterministic for a user and logged once.
- Control uses Monday midnight; weekend treatments use Friday midnight.
- The UI identifies the active internal test treatment without suggesting a paid benefit.

### Badges

- Community Builder is awarded after three unique supported videos/creators.
- Supporter is awarded after ten active Hypes across periods.
- Trendspotter is awarded when a supported video reaches the prototype leaderboard.
- Awards are unique per user and visible in Achievements when enabled.

## Non-goals

- Changing recommendation ranking, creator eligibility, or the leaderboard algorithm.
- Implementing purchases, Premium entitlements, real money, or real YouTube integration.
- Building a production abuse-classification system.
- Publicly exposing individual viewers’ Hype history.
- Treating badge thresholds as final without research.

## Metrics

Primary metrics:

- Percentage of users reaching three Hypes before local day 4, 5, 6, and 7 of their period.
- Percentage of eligible users who undo; percentage who reassign within the same session and within 24 hours.
- Self-reported allocation regret, collected through an optional post-action prompt.

Secondary metrics:

- Hypes per eligible active user.
- Queue open and return rate.
- Unique creators supported per user.
- Badge view rate and subsequent qualified Hype rate.
- Counter comprehension and reset-date comprehension.

Guardrails:

- Spam/coordinated activity rate does not increase by more than 10% relative.
- Viewer satisfaction does not decline by more than 2 percentage points.
- Creator support concentration (top 1% share) does not materially increase.
- API conflict/error rate remains below 0.5%; p95 quota check stays below 150 ms.
- Feed engagement does not decline by more than 1% relative.

## Experiment design

Randomization unit is authenticated user ID; assignment remains stable across devices. Analyze intent-to-treat over at least two full quota periods.

| Group | Schedule | Undo | Badges |
|---|---|---|---|
| Control | Monday | No | No |
| T1 `weekend_bonus` | Friday + weekend bonus | No | No |
| T2 `undo` | Monday | 24 hours | No |
| T3 `weekend_bonus_undo` | Friday + weekend bonus | 24 hours | No |
| T4 `badges` | Monday | No | Yes |

All groups receive the persistent counter so schedule and recovery effects are not confounded with basic quota comprehension. Pre-register segment cuts, minimum sample size, and stopping rules before launch.

## Abuse risks and mitigations

- Coordinated boosting: velocity limits, device/IP clustering, graph anomalies, and delayed leaderboard credit.
- Account farming: account-age/trust gates and per-device risk scoring.
- Undo cycling: log every state transition; cap suspicious cycles; count only active events.
- Race conditions and replay: server transactions, uniqueness constraints, idempotency keys, and optimistic retry.
- Badge farming: base badges on qualified, active events and revoke outcomes derived from invalidated activity.
- Privacy leakage: queue and badges are private by default; aggregate public counts with minimum thresholds.

## Technical requirements

The API provides `GET /api/hype-state/{user_id}`, `POST /api/hypes`, `GET /api/hype/queue`, `POST /api/hype/undo`, `POST /api/hype/reassign`, and `GET /api/badges`. Persistent entities are user settings, Hype events, badge definitions, user badges, and analytics events. The client polls on load and retains a local fallback for the standalone demo. See `TECH_DESIGN.md` for production controls.

## Launch stages

1. Internal test with forced flags and synthetic accounts.
2. 1% exposure with integrity dashboards and rollback thresholds.
3. 10% randomized experiment after one clean quota period.
4. Full experiment, then decision review by product, research, data science, integrity, privacy, and engineering.
