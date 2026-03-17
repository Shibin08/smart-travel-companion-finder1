Archived on 2026-03-17.

Contents:
- travel_companion.db
- travel_app.db

Reason:
- Both files were zero-byte, unused SQLite placeholders.
- The active runtime database remains backend/travel_app.db via backend/.env.
- They were moved only to reduce demo/project-folder confusion.
