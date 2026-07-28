# Hype Balance — Unofficial Concept

A front-end-only mobile prototype exploring how a video platform could show viewers their remaining weekly Hypes immediately after they support an emerging creator.

## Run locally

### Frontend only

Open `index.html` in a modern browser. The prototype still works as a standalone local experience and will fall back to its existing localStorage behavior if the backend is unavailable.

### Frontend + local backend

1. Install Python dependencies from [backend/requirements.txt](backend/requirements.txt).
2. Start the FastAPI server from the project root:

   ```bash
   uvicorn backend.app.main:app --reload
   ```

3. Open `index.html` in a browser.
4. Open an eligible video, tap Hype, and the app will try the local backend first. If the backend is running, the post-Hype card will show remaining Hypes, mock points, recent mock history, and reset timing.

The backend is intentionally local-only and does not connect to YouTube, Google, or any external service.

## Included interaction

- Home, Watch, Hype Explore, and profile/demo views
- Three simulated free Hypes per local calendar week, resetting Monday at 12:00 a.m.
- Browser `localStorage` persistence and a confirmed reset control
- Repeated Hypes on an eligible video, zero-balance protection, balance card dismissal, and compact balance status
- Keyboard focus styles, screen-reader balance announcements, and reduced-motion support

Manual test scenarios are listed in [tests/manual-test-checklist.md](./tests/manual-test-checklist.md).

All creators, videos, names, and activity are fictional mock data. This is an unofficial product concept and is not affiliated with or endorsed by YouTube or Google.
