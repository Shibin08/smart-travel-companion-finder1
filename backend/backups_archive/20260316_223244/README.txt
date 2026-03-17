Archive created: 2026-03-16 22:32:44

Purpose:
- Preserve old backup snapshots without cluttering the backend root.
- Keep active runtime files in their original locations.

Live files still used by the app:
- backend/travel_app.db
- backend/travel_companion_finder_dataset.csv

Current backend DB path from backend/.env:
- sqlite:///./travel_app.db

Notes:
- No backup data was deleted.
- Files in this folder were moved here from backend/.
- backend/travel_companion.db was left untouched because it is not part of the active runtime path.
