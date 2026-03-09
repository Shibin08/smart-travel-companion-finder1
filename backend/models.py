"""
SQLAlchemy ORM models for Smart Travel Companion Finder.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    destination = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    budget_range = Column(Float)
    interests = Column(String)
    travel_style = Column(String)
    language_preference = Column(String, nullable=True)
    gender = Column(String, default="Other")
    age = Column(Integer, nullable=True)
    bio = Column(String, nullable=True)
    home_country = Column(String, nullable=True)
    current_city = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    discoverable = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    matches_as_user1 = relationship(
        "Match", foreign_keys="Match.user1_id", back_populates="user1"
    )
    matches_as_user2 = relationship(
        "Match", foreign_keys="Match.user2_id", back_populates="user2"
    )
    sent_messages = relationship(
        "Message", foreign_keys="Message.sender_id", back_populates="sender"
    )
    received_messages = relationship(
        "Message", foreign_keys="Message.receiver_id", back_populates="receiver"
    )
    reviews_written = relationship(
        "Review", foreign_keys="Review.reviewer_id", back_populates="reviewer"
    )
    reviews_received = relationship(
        "Review", foreign_keys="Review.reviewee_id", back_populates="reviewee"
    )
    emergency_alerts = relationship(
        "EmergencyAlert", foreign_keys="EmergencyAlert.user_id", back_populates="user"
    )
    place_requests = relationship(
        "PlaceRequest", foreign_keys="PlaceRequest.user_id", back_populates="user"
    )


class Match(Base):
    __tablename__ = "matches"

    match_id = Column(Integer, primary_key=True, autoincrement=True)
    user1_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    user2_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    compatibility_score = Column(Float, nullable=False)
    status = Column(String, default="pending")  # pending / accepted / rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], back_populates="matches_as_user1")
    user2 = relationship("User", foreign_keys=[user2_id], back_populates="matches_as_user2")


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    receiver_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    message_text = Column(String, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")


class Review(Base):
    __tablename__ = "reviews"

    review_id = Column(Integer, primary_key=True, autoincrement=True)
    reviewer_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    reviewee_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    match_id = Column(Integer, ForeignKey("matches.match_id"), nullable=True)
    rating = Column(Float, nullable=False)
    comment = Column(String, nullable=False)
    communication = Column(Float, nullable=False, default=0)
    reliability = Column(Float, nullable=False, default=0)
    compatibility = Column(Float, nullable=False, default=0)
    overall = Column(Float, nullable=False, default=0)
    is_public = Column(Boolean, default=True)
    helpful_votes = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    reviewer = relationship("User", foreign_keys=[reviewer_id], back_populates="reviews_written")
    reviewee = relationship("User", foreign_keys=[reviewee_id], back_populates="reviews_received")


class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    alert_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    alert_type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="High")
    status = Column(String, nullable=False, default="Active")
    latitude = Column(Float, nullable=False, default=0)
    longitude = Column(Float, nullable=False, default=0)
    address = Column(String, nullable=False, default="Unknown")
    responders = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="emergency_alerts")


class PlaceRequest(Base):
    __tablename__ = "place_requests"

    request_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    user_name = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    place_image = Column(String, nullable=False, default="")
    pin_lat = Column(Float, nullable=False, default=0)
    pin_lng = Column(Float, nullable=False, default=0)
    pin_label = Column(String, nullable=False, default="")
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=False)
    companions_needed = Column(Integer, nullable=False, default=1)
    budget = Column(String, nullable=False)
    travel_type = Column(String, nullable=False)
    notes = Column(String, nullable=False)
    status = Column(String, nullable=False, default="Open")
    applicants = Column(String, nullable=False, default="")
    tags = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id], back_populates="place_requests")


class ReviewVote(Base):
    """Tracks which users have voted a review as helpful (prevents duplicate votes)."""
    __tablename__ = "review_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.review_id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
