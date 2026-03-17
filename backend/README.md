# Smart Travel Companion Finder Backend

FastAPI backend for authentication, matching, realtime chat, reviews, emergency alerts, and open trip requests.

The full project overview lives in the repository root:

- [Project README](../README.md)

## Active Local Database

The current runtime database is:

- `backend/travel_app.db`

The backend reads this from `backend/.env`:

```env
DATABASE_URL=sqlite:///./travel_app.db
```

`travel_companion.db` is not part of the active runtime path and was archived under `backend/backups_archive/20260317_legacy_runtime_placeholder/`.

## Start The Backend

From the repository root:

```powershell
python backend\start_server.py
```

Or from inside `backend/`:

```powershell
python start_server.py
```

## Backend Tests

```powershell
cd backend
..\.venv\Scripts\python.exe -m unittest tests.test_chat_websocket tests.test_recommendation_filters tests.test_smoke_flow
```
