"""
Pydantic schemas for Smart Travel Companion Finder.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ──────────────────────────────
# User schemas
# ──────────────────────────────

class UserCreate(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    gender: Optional[str] = "Other"
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_range: Optional[float] = None
    interests: Optional[str] = None
    travel_style: Optional[str] = None
    discoverable: bool = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    user_id: str
    name: str
    email: EmailStr
    gender: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    home_country: Optional[str] = None
    current_city: Optional[str] = None
    photo_url: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_range: Optional[float] = None
    interests: Optional[str] = None
    travel_style: Optional[str] = None
    personality_type: Optional[str] = None
    language_preference: Optional[str] = None
    discoverable: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────
# Match schemas
# ──────────────────────────────

class MatchResponse(BaseModel):
    match_id: int
    user1_id: str
    user2_id: str
    compatibility_score: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MatchUserInfo(BaseModel):
    """User info embedded in match responses."""
    user_id: str
    name: str
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


class MatchWithUserResponse(BaseModel):
    """A match record with the other user's basic info."""
    match_id: int
    compatibility_score: float
    status: str
    created_at: Optional[datetime] = None
    requested_by_current_user: Optional[bool] = None
    can_current_user_accept: Optional[bool] = None
    trip_completed: Optional[bool] = None
    can_current_user_end_chat: Optional[bool] = None
    end_chat_available_on: Optional[str] = None
    other_user: MatchUserInfo

    class Config:
        from_attributes = True


class MatchListResponse(BaseModel):
    """Wrapper for a list of matches."""
    total: int
    matches: list[MatchWithUserResponse]


# ──────────────────────────────
# Chat / Message schemas
# ──────────────────────────────

class ChatMessageCreate(BaseModel):
    receiver_id: str = Field(..., min_length=1)
    message_text: str = Field(..., min_length=1, max_length=5000)


class ChatMessageResponse(BaseModel):
    message_id: int
    sender_id: str
    receiver_id: str
    message_text: str
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    """Summary of a conversation with another user."""
    user_id: str
    name: str
    last_message: str
    last_message_timestamp: datetime


# ──────────────────────────────
# Reviews schemas
# ──────────────────────────────

class ReviewCategories(BaseModel):
    communication: float = Field(..., ge=1, le=5)
    reliability: float = Field(..., ge=1, le=5)
    compatibility: float = Field(..., ge=1, le=5)
    overall: float = Field(..., ge=1, le=5)


class ReviewCreate(BaseModel):
    reviewee_id: str = Field(..., min_length=1)
    match_id: Optional[int] = None
    rating: float = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=1, max_length=2000)
    categories: ReviewCategories
    is_public: bool = True


class ReviewUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)
    categories: Optional[ReviewCategories] = None
    is_public: Optional[bool] = None


class ReviewResponse(BaseModel):
    review_id: int
    reviewer_id: str
    reviewee_id: str
    match_id: Optional[int] = None
    rating: float
    comment: str
    categories: ReviewCategories
    is_public: bool
    helpful_votes: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ReviewListResponse(BaseModel):
    total: int
    reviews: list[ReviewResponse]


# ──────────────────────────────
# Emergency schemas
# ──────────────────────────────

class EmergencyLocation(BaseModel):
    latitude: float
    longitude: float
    address: str


class EmergencyAlertCreate(BaseModel):
    alert_type: str = Field(..., pattern=r'^(SOS|Medical|Lost|Theft|Other)$')
    message: str = Field(..., min_length=1, max_length=2000)
    severity: str = Field("High", pattern=r'^(Low|Medium|High|Critical)$')
    location: EmergencyLocation


class EmergencyAlertStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r'^(Active|Acknowledged|Resolved)$')


class EmergencyAlertResponse(BaseModel):
    alert_id: int
    user_id: str
    alert_type: str
    message: str
    severity: str
    status: str
    location: EmergencyLocation
    responders: list[str]
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class EmergencyAlertListResponse(BaseModel):
    total: int
    alerts: list[EmergencyAlertResponse]


# ──────────────────────────────
# Place request schemas
# ──────────────────────────────

class PlaceRequestCreate(BaseModel):
    destination: str = Field(..., min_length=1, max_length=200)
    place_image: str = Field("", max_length=500)
    pin_lat: float = Field(..., ge=-90, le=90)
    pin_lng: float = Field(..., ge=-180, le=180)
    pin_label: str = Field(..., min_length=1, max_length=200)
    start_date: str = Field(..., min_length=1)
    end_date: str = Field(..., min_length=1)
    companions_needed: int = Field(..., ge=1, le=20)
    budget: str = Field(..., pattern=r'^(Low|Medium|High)$')
    travel_type: str = Field(..., min_length=1, max_length=50)
    notes: str = Field(..., min_length=15, max_length=2000)
    status: str = Field("Open", pattern=r'^(Open|In Progress|Closed)$')


class PlaceRequestResponse(BaseModel):
    request_id: int
    user_id: str
    user_name: str
    destination: str
    place_image: str
    pin_lat: float
    pin_lng: float
    pin_label: str
    start_date: str
    end_date: str
    companions_needed: int
    budget: str
    travel_type: str
    notes: str
    status: str
    applicants: list[str]
    created_at: Optional[datetime] = None


class PlaceRequestListResponse(BaseModel):
    total: int
    requests: list[PlaceRequestResponse]


class JoinPlaceRequestResponse(BaseModel):
    message: str
    poster_user_id: str
    request_id: int

# ──────────────────────────────
# Profile Update schemas
# ──────────────────────────────

class UpdateProfileRequest(BaseModel):
    """Schema for updating user profile information."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    gender: Optional[str] = Field(None, pattern=r'^(Male|Female|Non-Binary|Other)$')
    age: Optional[int] = Field(None, ge=18, le=120)
    bio: Optional[str] = Field(None, max_length=500)
    home_country: Optional[str] = Field(None, max_length=100)
    current_city: Optional[str] = Field(None, max_length=100)
    photo_url: Optional[str] = Field(None, max_length=500)
    destination: Optional[str] = Field(None, max_length=200)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    budget_range: Optional[float] = Field(None, ge=0, le=1_000_000)
    interests: Optional[str] = Field(None, max_length=1000)
    travel_style: Optional[str] = Field(None, max_length=50)
    personality_type: Optional[str] = Field(None, pattern=r'^(Introvert|Extrovert|Ambivert)$')
    language_preference: Optional[str] = Field(None, max_length=100)
    discoverable: Optional[bool] = None


class UpdatePhotoResponse(BaseModel):
    """Schema for photo upload response."""
    photo_url: str
    message: str

    class Config:
        from_attributes = True
