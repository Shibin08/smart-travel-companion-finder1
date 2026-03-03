# Smart Travel Companion Finder — Backend

FastAPI REST API powering the Smart Travel Companion Finder. Handles authentication, companion matching, chat, reviews, emergency alerts, and place requests.

## Tech Stack
                        
 FastAPI          -   Web framework + OpenAPI docs     
 SQLAlchemy       -   ORM (SQLite / PostgreSQL)        
 python-jose      -   JWT token creation & validation  
 passlib + argon2 -   Argon2id password hashing        
 slowapi          -   Rate limiting                    
 python-dotenv    -   Environment variable loading     
 python-multipart -   File upload (profile photos)     
 uvicorn          -   ASGI server                      

## Features

### Authentication & Security
- **JWT Bearer tokens** — 60-minute expiry, HS256 signing
- **Argon2id password hashing** — via passlib
- **Rate limiting** — 5 requests/minute on `/login` and `/register` (slowapi)
- **Input validation** — Pydantic `Field` constraints on all request schemas (password 8–128 chars, rating 1–5, comment ≤ 2000 chars, bio ≤ 500 chars, budget 0–1M, gender regex, etc.)
- **CORS** — Configurable allowed origins via `ALLOWED_ORIGINS` env variable
- **Change password** — Authenticated endpoint verifies current password before update

### Matching Algorithm
Weighted compatibility scoring (0–100 scale):

| Factor               | Weight |
| --------------       | ------ |
| Destination          | 30%    |
| Interests (Jaccard)  | 20%    |
| Dates overlap        | 15%    |
| Budget similarity    | 15%    |
| Travel style         | 10%    |
| Base bonus           | 10%    |

- Search-time trip overrides (destination, dates, budget, style) without modifying stored profile
- Returns up to 100 ranked companions above a minimum score threshold

### Match State Machine
Enforced status transitions — terminal states have no outgoing edges:

```
pending  →  accepted / rejected / cancelled
accepted →  cancelled
rejected →  (terminal)
cancelled → (terminal)
```

### Chat
- **Send messages** — Only between users with an accepted match
- **Conversations list** — De-duplicated partners with last message, sorted by recency
- **Paginated history** — `GET /chat/{user_id}?limit=50&offset=0`

### Reviews
- Multi-category ratings (communication, reliability, compatibility, overall)
- Helpful vote system
- CRUD operations (create, list, update, delete)

### Emergency Alerts
- Create alerts with geolocation (lat/lng + address)
- Severity levels and status tracking (Active → Resolved)

### Place Requests
- Post travel companion requests for specific destinations
- Includes map pin, dates, budget, companion count, and applicant tracking

### Database
- **6 models**: User, Match, Message, Review, EmergencyAlert, PlaceRequest
- **Indexes** on all foreign key columns (`user1_id`, `user2_id`, `sender_id`, `receiver_id`) for fast joins
- Auto-creates tables in development mode (`ENV=development`)

## Run Locally

### Prerequisites
- Python 3.10+
- pip

### Steps

1. Create and activate a virtual environment:

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[argon2] python-dotenv slowapi python-multipart pydantic[email]
   ```

3. Create `.env` from the example:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set a strong `SECRET_KEY`:

   ```env
   DATABASE_URL=sqlite:///./travel_app.db
   SECRET_KEY=your-strong-random-secret-key
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   ```

   Generate a production-grade secret:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```

4. Start the server:

   ```bash
   python start_server.py
   ```

   Or directly with uvicorn:

   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

5. Open interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs)

## Project Structure

```
backend/
├── app.py                Main FastAPI app, route registration, CORS, rate limiter
├── auth.py               JWT creation/verification, Argon2 hashing, get_current_user
├── chat.py               Chat router (send, conversations, paginated history)
├── config.py             Environment config loader with validation
├── database.py           SQLAlchemy engine, SessionLocal, get_db dependency
├── datasetloader.py      CSV dataset import utility
├── emergency.py          Emergency alerts router
├── matching.py           Scoring algorithm, match CRUD, state machine
├── models.py             6 SQLAlchemy ORM models
├── photo_utils.py        Photo upload/deletion/default helpers
├── place_requests.py     Place requests router
├── reviews.py            Reviews router (CRUD + helpful votes)
├── schemas.py            Pydantic request/response schemas with Field constraints
├── start_server.py       Uvicorn launcher script
├── .env.example          Environment variable template
└── uploads/              User-uploaded profile photos
```
