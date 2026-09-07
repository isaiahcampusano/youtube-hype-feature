# Backend

The local FastAPI service is the authoritative implementation of the Hype prototype’s quota and experiment rules.

## Endpoints

- `GET /health`
- `GET /api/hype-state/{user_id}`
- `POST /api/hypes`
- `GET /api/hype/queue?userId=...`
- `POST /api/hype/undo`
- `POST /api/hype/reassign`
- `GET /api/badges?userId=...`
- `POST /api/reset-demo`

Start from the repository root with `python -m uvicorn backend.app.main:app --reload`. OpenAPI documentation is available at `/docs` and `/redoc`.

For local development, tables are created automatically. `migrations/001_tightened_features.sql` documents the upgrade shape for an existing prototype database; use a reviewed migration tool and backfill plan for production.

Security note: the prototype accepts a user ID from the request to simplify demonstration. A production service must take identity from authentication, restrict CORS, use a production database, and implement the concurrency controls in `docs/TECH_DESIGN.md`.
