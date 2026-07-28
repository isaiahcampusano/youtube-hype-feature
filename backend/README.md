# Hype Balance Backend Prototype

This backend is a local-only FastAPI service that models the same weekly Hype rules as the frontend prototype.

## What it provides

- A health endpoint for local verification
- A demo-user Hype state endpoint
- A Hype creation endpoint that enforces the three-Hypes-per-week rule
- A demo reset endpoint for local testing

## Local setup

1. Open a terminal in this folder.
2. Create and activate a Python 3.11+ virtual environment.
3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the API:

   ```bash
   uvicorn backend.app.main:app --reload
   ```

5. Visit the API docs at:

   - http://127.0.0.1:8000/docs
   - http://127.0.0.1:8000/redoc

## Environment variables

- `DATABASE_URL`: SQLite connection string. Defaults to `sqlite:///./backend/hype.db`.
- `TIMEZONE`: IANA timezone name. Defaults to `America/New_York`.

## Prototype notes

- This project does not connect to YouTube, Google, or any external service.
- The backend is intentionally simple and is meant to be a stepping stone for later frontend integration.
- The frontend should keep using its existing localStorage logic until the API is wired up.

## Future integration plan

When the frontend is ready to use the backend:

1. Add a small API helper module in the frontend that calls the FastAPI endpoints.
2. Replace the existing localStorage-based Hype actions with API calls while keeping the UI intact.
3. Keep the current UI and page structure unchanged.
4. Continue to use the backend as the source of truth for balance and history.
