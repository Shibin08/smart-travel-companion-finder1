"""
FastAPI Backend for Smart Travel Companion Finder

Endpoints:

GET  /               - Health check
POST /register       - Create a new user account
POST /login          - Authenticate and receive a JWT
POST /recommend      - Get top 100 travel companion matches (protected)
GET  /matches                      - List current user's matches (protected)
POST /matches/accept              - Create a match (pending) (protected)
PATCH /matches/{match_id}/status  - Update match status (protected)
POST /chat/send                   - Send a message (protected, requires accepted match)
GET  /chat/{id}                   - Get conversation history (protected)
"""

import os
import logging
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from auth import create_access_token, get_current_user, hash_password, verify_password
from config import GOOGLE_CLIENT_ID
from database import Base, engine, ensure_match_pair_guard, get_db
from matching import find_matches, get_user_matches, store_match, update_match_status
from models import User
from chat import router as chat_router
from reviews import router as reviews_router
from emergency import router as emergency_router
from place_requests import router as place_requests_router
from photo_utils import get_default_photo, save_photo_file, delete_old_photo, is_local_photo
from schemas import MatchListResponse, MatchResponse, MatchWithUserResponse, UpdatePhotoResponse, UpdateProfileRequest, UserCreate, UserLogin, UserResponse

# Only auto-create tables in development mode
if os.getenv("ENV") == "development":
    Base.metadata.create_all(bind=engine)

logger = logging.getLogger(__name__)
MAX_PHOTO_SIZE_MB = 10
MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024

app = FastAPI(
    title="Smart Travel Companion Finder API",
    description="Compatibility-based travel companion recommendation system",
    version="1.0.0",
)

# Rate limiter — 5 attempts per minute on auth endpoints
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for serving uploaded photos
from pathlib import Path
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
try:
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
except Exception as e:
    logger.warning("Could not mount uploads directory: %s", e)

app.include_router(chat_router)
app.include_router(reviews_router)
app.include_router(emergency_router)
app.include_router(place_requests_router)


@app.on_event("startup")
def startup_db_guards() -> None:
    """Apply DB guardrails needed by runtime logic."""
    ensure_match_pair_guard()


# ----------------------------
# Response Models
# ----------------------------

class ScoreBreakdown(BaseModel):
    destination: float = 0.0
    dates: float = 0.0
    budget: float = 0.0
    interests: float = 0.0
    travel_style: float = 0.0
    age: float = 0.0


class RecommendMatchItem(BaseModel):
    user_id: str
    name: str
    compatibility_score: float
    score_breakdown: Optional[ScoreBreakdown] = None
    photo_url: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    travel_style: Optional[str] = None
    interests: Optional[str] = None
    budget_range: Optional[float] = None
    home_country: Optional[str] = None
    current_city: Optional[str] = None
    bio: Optional[str] = None
    review_avg_rating: Optional[float] = None
    review_count: int = 0


class RecommendResponse(BaseModel):
    total_matches: int
    matches: List[RecommendMatchItem]


class TripSearchParams(BaseModel):
    """Optional trip-level search overrides sent from the frontend form."""
    destination: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[str] = None
    travel_style: Optional[str] = None
    strict_filters: bool = False



class AcceptMatchRequest(BaseModel):
    matched_user_id: str = Field(..., example="U042")
    compatibility_score: float = Field(..., ge=0, le=100, example=78.5)


class UpdateMatchStatusRequest(BaseModel):
    status: str = Field(..., example="accepted", description="One of: pending, accepted, rejected, cancelled")


# ----------------------------
# Health Check
# ----------------------------

@app.get("/")
def health_check():
    return {"status": "Backend running successfully"}


@app.get("/users/{user_id}/public")
def get_user_public_profile(
    user_id: str,
    db: Session = Depends(get_db),
):
    """Return minimal public profile info for a user (name, photo, gender).
    
    Note: This is intentionally unauthenticated so conversation partner
    avatars can be loaded, but it only exposes minimal fields.
    """
    db_user = db.query(User).filter(User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": db_user.user_id,
        "name": db_user.name,
        "photo_url": db_user.photo_url,
        "gender": db_user.gender or "Other",
        "age": db_user.age,
        "travel_style": db_user.travel_style,
        "interests": db_user.interests,
        "budget_range": db_user.budget_range,
        "home_country": db_user.home_country,
        "current_city": db_user.current_city,
        "bio": db_user.bio,
    }


@app.get("/profile/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the full profile for the currently authenticated user."""
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ----------------------------
# Authentication Endpoints
# ----------------------------

@app.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account with auto-assigned default photo based on gender."""

    # Check duplicate email
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check duplicate user_id
    if db.query(User).filter(User.user_id == user.user_id).first():
        raise HTTPException(status_code=400, detail="User ID already taken")

    # Get default photo based on gender
    default_photo = get_default_photo(user.gender or "Other")

    db_user = User(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        hashed_password=hash_password(user.password),  # 🔥 THIS LINE IS IMPORTANT
        gender=user.gender or "Other",
        photo_url=default_photo,
        destination=user.destination,
        start_date=user.start_date,
        end_date=user.end_date,
        budget_range=user.budget_range,
        interests=user.interests,
        travel_style=user.travel_style,
        discoverable=user.discoverable,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


from fastapi.security import OAuth2PasswordRequestForm

@app.post("/login")
@limiter.limit("5/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": user.user_id})

    return {"access_token": access_token, "token_type": "bearer"}


class GoogleTokenPayload(BaseModel):
    credential: str


@app.post("/auth/google")
@limiter.limit("10/minute")
def google_auth(request: Request, payload: GoogleTokenPayload, db: Session = Depends(get_db)):
    """Verify a Google ID token, create the user if new, and return a JWT."""

    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google Sign-In is not configured on the server")

    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
    import secrets

    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email: str = idinfo.get("email", "")
    name: str = idinfo.get("name", "")
    picture: str = idinfo.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # Look for existing user by email
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Auto-register
        user_id = email.split("@")[0] + "_" + secrets.token_hex(4)
        default_photo = picture or get_default_photo("Other")

        user = User(
            user_id=user_id,
            name=name or email.split("@")[0],
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),  # random password
            gender="Other",
            photo_url=default_photo,
            discoverable=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}


# ----------------------------
# Recommendation Endpoint (protected)
# ----------------------------

@app.post("/recommend", response_model=RecommendResponse)
def recommend(
    body: Optional[TripSearchParams] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return up to 100 compatible travel companions (requires authentication).

    Accepts optional trip search parameters that override the user's
    stored profile for this particular search.
    """
    trip_override = None
    if body:
        trip_override = {}
        if body.destination:
            trip_override["destination"] = body.destination
        if body.start_date:
            from datetime import datetime as _dt, date as _date
            try:
                parsed_start = _dt.fromisoformat(body.start_date)
                if parsed_start.date() < _date.today():
                    raise HTTPException(
                        status_code=400,
                        detail="Start date cannot be in the past. Please select today or a future date."
                    )
                trip_override["start_date"] = parsed_start
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start date format.")
        if body.end_date:
            from datetime import datetime as _dt, date as _date
            try:
                parsed_end = _dt.fromisoformat(body.end_date)
                if parsed_end.date() < _date.today():
                    raise HTTPException(
                        status_code=400,
                        detail="End date cannot be in the past. Please select today or a future date."
                    )
                trip_override["end_date"] = parsed_end
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end date format.")
        if body.budget:
            trip_override["budget_range"] = body.budget
        if body.travel_style:
            trip_override["travel_style"] = body.travel_style
        if body.strict_filters:
            trip_override["strict_filters"] = True
        # Cross-field validation: end_date must not be before start_date
        if "start_date" in trip_override and "end_date" in trip_override:
            if trip_override["end_date"] < trip_override["start_date"]:
                raise HTTPException(
                    status_code=400,
                    detail="End date cannot be before start date."
                )

    matches = find_matches(current_user, db, trip_override=trip_override)

    return {
        "total_matches": len(matches),
        "matches": matches,
    }


# ----------------------------
# List Matches Endpoint (protected)
# ----------------------------

@app.get("/matches", response_model=MatchListResponse)
def list_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all pending and accepted matches for the authenticated user.

    Each match includes the other user's basic info (user_id, name).
    """
    matches = get_user_matches(db, current_user.user_id)
    return {"total": len(matches), "matches": matches}


# ----------------------------
# Accept Match Endpoint (protected)
# ----------------------------

@app.post("/matches/accept", response_model=MatchResponse, status_code=201)
def accept_match(
    body: AcceptMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a pending match between the current user and another user.

    If a match already exists between the pair, the existing match is
    returned (no duplicate is created).
    """

    if body.matched_user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot match with yourself")

    # Verify the matched user exists
    other = db.query(User).filter(User.user_id == body.matched_user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="Matched user not found")

    match, created = store_match(
        db,
        user1_id=current_user.user_id,
        user2_id=body.matched_user_id,
        compatibility_score=body.compatibility_score,
    )

    return match


# ----------------------------
# Update Match Status Endpoint (protected)
# ----------------------------

@app.patch("/matches/{match_id}/status", response_model=MatchResponse)
def change_match_status(
    match_id: int,
    body: UpdateMatchStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the status of an existing match.

    Only a user who is part of the match may change its status.
    Valid statuses: pending, accepted, rejected, cancelled.
    """
    try:
        match = update_match_status(
            db,
            match_id=match_id,
            new_status=body.status,
            current_user_id=current_user.user_id,
        )
    except ValueError as exc:
        msg = str(exc)
        if "not part of this match" in msg or "Only the request recipient can accept" in msg:
            raise HTTPException(status_code=403, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

    return match

# ----------------------------
# Profile Endpoints (protected)
# ----------------------------

@app.put("/profile/update", response_model=UserResponse)
def update_profile(
    update_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user profile information (protected)."""
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update fields if provided
    if update_data.name is not None:
        user.name = update_data.name
    if update_data.gender is not None:
        user.gender = update_data.gender
    if update_data.age is not None:
        user.age = update_data.age
    if update_data.bio is not None:
        user.bio = update_data.bio
    if update_data.home_country is not None:
        user.home_country = update_data.home_country
    if update_data.current_city is not None:
        user.current_city = update_data.current_city
    if update_data.destination is not None:
        user.destination = update_data.destination
    if update_data.start_date is not None:
        from datetime import datetime as _dt, date as _date
        try:
            parsed = _dt.fromisoformat(str(update_data.start_date))
            if parsed.date() < _date.today():
                raise HTTPException(status_code=400, detail="Start date cannot be in the past.")
        except (ValueError, TypeError):
            pass
        user.start_date = update_data.start_date
    if update_data.end_date is not None:
        from datetime import datetime as _dt, date as _date
        try:
            parsed = _dt.fromisoformat(str(update_data.end_date))
            if parsed.date() < _date.today():
                raise HTTPException(status_code=400, detail="End date cannot be in the past.")
        except (ValueError, TypeError):
            pass
        user.end_date = update_data.end_date

    # Cross-field: end_date must not be before start_date
    if user.start_date and user.end_date and user.end_date < user.start_date:
        raise HTTPException(status_code=400, detail="End date cannot be before start date.")

    if update_data.budget_range is not None:
        user.budget_range = update_data.budget_range
    if update_data.interests is not None:
        user.interests = update_data.interests
    if update_data.travel_style is not None:
        user.travel_style = update_data.travel_style
    if update_data.language_preference is not None:
        user.language_preference = update_data.language_preference
    if update_data.discoverable is not None:
        user.discoverable = update_data.discoverable
    if update_data.photo_url is not None:
        user.photo_url = update_data.photo_url

    db.commit()
    db.refresh(user)
    return user


@app.post("/profile/upload-photo", response_model=UpdatePhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a profile photo (protected)."""
    print(f"📸 Upload photo request from user: {current_user.user_id}")
    
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        print(f"❌ User not found: {current_user.user_id}")
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Validate file type
        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        print(f"📝 File: {file.filename}, Content-Type: {file.content_type}")
        
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

        # Read file content
        content = await file.read()
        print(f"📦 File size: {len(content)} bytes")

        # Validate file size (max 10MB)
        if len(content) > MAX_PHOTO_SIZE_BYTES:
            raise HTTPException(status_code=400, detail=f"File size exceeds {MAX_PHOTO_SIZE_MB}MB limit")

        # Delete old photo if it's a local file
        if user.photo_url and is_local_photo(user.photo_url):
            delete_old_photo(user.photo_url)

        # Get file extension
        file_ext = file.filename.split(".")[-1].lower() if file.filename else "jpg"

        # Save the new photo
        photo_path = save_photo_file(content, user.user_id, file_ext)
        print(f"✅ Photo saved: {photo_path}")

        # Update user's photo URL
        user.photo_url = photo_path
        db.commit()
        db.refresh(user)

        print(f"✅ Upload complete for user: {current_user.user_id}")
        return {"photo_url": user.photo_url, "message": "Photo uploaded successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Upload error for user_id=%s", current_user.user_id)
        raise HTTPException(status_code=500, detail=f"Failed to upload photo: {str(e)}")


@app.get("/profile/default-photo")
def get_default_photo_endpoint(gender: str = "Other"):
    """Get default photo URL for a specific gender."""
    default_photo = get_default_photo(gender)
    return {"photo_url": default_photo}


# ----------------------------
# Change Password Endpoint (protected)
# ----------------------------

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


@app.post("/profile/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the authenticated user's password."""
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "Password changed successfully"}
