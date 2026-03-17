# Smart Travel Companion Finder

Smart Travel Companion Finder is a final-year project that helps travelers discover compatible companions, manage match requests, and chat in real time once a match is accepted.

## Problem Statement

Solo travelers often struggle to find safe, compatible travel partners. Generic social apps do not consider trip dates, destination overlap, budget compatibility, travel style, or safety workflows. This project solves that gap with profile-based matching, verified match states, realtime chat, reviews, emergency alerts, and open trip requests.

## What The Project Covers

- Companion recommendations ranked by weighted compatibility scoring
- Match request workflow with controlled status transitions
- Realtime one-to-one chat over WebSockets with database persistence
- Reviews and helpful votes after completed trips
- Emergency SOS alerts with location data
- Open trip requests for destination-specific companion discovery

## Tech Stack

### Frontend

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 3
- React Router 7

### Backend

- FastAPI
- SQLAlchemy
- SQLite for local/demo runtime
- JWT authentication
- SlowAPI rate limiting


### Runtime Notes

- The active local database is `backend/travel_app.db`.
- `backend/.env` line 2 points `DATABASE_URL` to `sqlite:///./travel_app.db`.
- The old `travel_companion.db` file is not part of the runtime path and was archived under `backend/backups_archive/20260317_legacy_runtime_placeholder/`.

## Matching Logic

The backend calculates a compatibility score out of 100 using weighted factors in `backend/matching.py`.

| Factor | Weight |
| --- | ---: |
| Destination match | 14% |
| Date overlap | 23% |
| Budget similarity | 14% |
| Interest overlap | 18% |
| Travel style similarity | 23% |
| Age proximity | 8% |

Additional matching behavior:

- Search requests can override destination, dates, budget, and travel style without changing the saved profile.
- Strict filtering can reduce results before scoring.
- Only discoverable users are considered.
- Local QC/smoke test accounts are filtered out of recommendation results.
- Public review averages and counts are attached to recommendation cards.

## Realtime Chat Design

- WebSocket endpoint: `/chat/ws`
- REST fallback send endpoint: `/chat/send`
- Conversation history endpoint: `/chat/{other_user_id}`
- Conversation summary endpoint: `/chat/conversations`

How it works:

1. The frontend opens a WebSocket using the current JWT token.
2. The backend validates the token and registers the connection by `user_id`.
3. A message can only be sent if an accepted match exists between the two users.
4. The message is stored in SQLite first.
5. The backend pushes the saved message to both users so chat pages and conversation lists update immediately.
6. If the socket is temporarily unavailable, the frontend falls back to the REST send endpoint.

## Backend Data Model

Main tables:

- `users`
- `matches`
- `messages`
- `reviews`
- `review_votes`
- `emergency_alerts`
- `place_requests`

## Exact Run Steps

### 1. Backend setup

From the repository root:

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[argon2] python-dotenv slowapi python-multipart pydantic[email] anyio

The backend already expects:

```env
DATABASE_URL=sqlite:///./travel_app.db
```

Start the backend with the launcher script requested for this project:

```powershell
python backend\start_server.py
```

The API will be available at `http://127.0.0.1:8000`.

### 2. Frontend setup

Open a second terminal:

cd Smart-travel-companion-finder-main
npm install

Run the frontend in development mode:

npm run dev

### 3. Production build for submission/demo

From `Smart-travel-companion-finder-main`:

npm run build
npm run preview

