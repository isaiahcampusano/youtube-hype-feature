# Hype Balance prototype

A copyright-safe, fictional video product concept exploring clearer Hype quotas, reset-schedule experiments, 24-hour undo/reassignment, and lightweight achievements.

## What changed

- Remaining Hypes and an exact localized reset date appear in the feed, watch view, and Explore view.
- Stable A/B assignment supports control, Weekend Bonus, undo, combined, and badges treatments.
- The profile includes an experiment notice, current-period Hype queue, countdowns, undo, reassignment, and achievements.
- Each eligible video can receive only one Hype from a viewer per quota period.
- After a successful Hype, an optional feedback survey records why the viewer chose it.
- The FastAPI service enforces quotas, stores soft-deleted events, prevents request replay, awards badges, and logs experiment events.
- A local browser store keeps the static prototype functional when the API is offline.
- All thumbnails, creators, activity, points, and brand elements are generic mock content.

## Run locally

From the repository root, install and start the API:

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

In a second terminal, serve the static client:

```bash
python -m http.server 5173
```

Open `http://127.0.0.1:5173`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

## Verify

```bash
python -m pytest backend/tests -q
node --check js/app.js
node --check js/hype-store.js
node --check js/hype-backend.js
npm test
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./backend/hype.db` | Database connection |
| `TIMEZONE` | `America/New_York` | Invalid/missing timezone fallback |
| `HYPE_EXPERIMENT_ENABLED` | `true` | Stable experiment assignment |
| `HYPE_UNDO_ENABLED` | group-dependent | Force undo on/off |
| `HYPE_BADGES_ENABLED` | group-dependent | Force badges on/off |
| `HYPE_WEEKEND_BONUS_MODE` | `unlimited` | `unlimited` or `extra_3` |
| `HYPE_BASE_QUOTA` | `3` | Base period allowance |

## Product documentation

- [Research synthesis](docs/RESEARCH.md)
- [Product requirements](docs/PRD.md)
- [Technical design](docs/TECH_DESIGN.md)
- [Manual test checklist](tests/manual-test-checklist.md)

The original hosted demo may lag this branch: https://isaiahcampusano.github.io/youtube-hype-feature/
