"""
Chat endpoints for Smart Travel Companion Finder.

POST /chat/send              – Send a message (requires accepted match)
GET  /chat/conversations     – List all conversation partners with last message
GET  /chat/{other_user_id}   – Retrieve conversation history (paginated)
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Match, Message, User
from schemas import ChatMessageCreate, ChatMessageResponse, ConversationSummary

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("/send", response_model=ChatMessageResponse)
def send_message(
    body: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to another user.

    Only allowed when an accepted match exists between the two users.
    """
    # Prevent sending messages to yourself
    if body.receiver_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Verify receiver exists
    receiver = db.query(User).filter(User.user_id == body.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # Check for an accepted match between the two users
    accepted_match = (
        db.query(Match)
        .filter(
            Match.status == "accepted",
            or_(
                (Match.user1_id == current_user.user_id) & (Match.user2_id == body.receiver_id),
                (Match.user1_id == body.receiver_id) & (Match.user2_id == current_user.user_id),
            ),
        )
        .first()
    )
    if not accepted_match:
        raise HTTPException(
            status_code=403,
            detail="You can only message users with an accepted match",
        )

    message = Message(
        sender_id=current_user.user_id,
        receiver_id=body.receiver_id,
        message_text=body.message_text,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    return message


@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a de-duplicated list of users the current user has chatted with,
    including the last message and its timestamp, sorted by most recent first."""

    uid = current_user.user_id

    # Derive the "other" user id for every message involving the current user
    other_id = case(
        (Message.sender_id == uid, Message.receiver_id),
        else_=Message.sender_id,
    ).label("other_id")

    # Subquery: latest message_id per conversation partner
    sub = (
        db.query(
            other_id,
            func.max(Message.message_id).label("last_msg_id"),
        )
        .filter(or_(Message.sender_id == uid, Message.receiver_id == uid))
        .group_by(other_id)
        .subquery()
    )

    # Join back to Message + User to get full details
    rows = (
        db.query(
            sub.c.other_id,
            User.name,
            Message.message_text,
            Message.timestamp,
        )
        .select_from(sub)
        .join(Message, Message.message_id == sub.c.last_msg_id)
        .join(User, User.user_id == sub.c.other_id)
        .order_by(Message.timestamp.desc())
        .all()
    )

    return [
        ConversationSummary(
            user_id=row.other_id,
            name=row.name,
            last_message=row.message_text,
            last_message_timestamp=row.timestamp,
        )
        for row in rows
    ]


@router.get("/{other_user_id}", response_model=List[ChatMessageResponse])
def get_conversation(
    other_user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the paginated conversation between the current user and another user,
    sorted by timestamp ascending.  Defaults to the latest 50 messages."""

    # Verify an accepted match exists between the two users
    match = (
        db.query(Match)
        .filter(
            or_(
                (Match.user1_id == current_user.user_id) & (Match.user2_id == other_user_id),
                (Match.user1_id == other_user_id) & (Match.user2_id == current_user.user_id),
            ),
            Match.status == "accepted",
        )
        .first()
    )
    if not match:
        raise HTTPException(status_code=403, detail="No accepted match with this user")

    total_q = (
        db.query(Message)
        .filter(
            or_(
                (Message.sender_id == current_user.user_id) & (Message.receiver_id == other_user_id),
                (Message.sender_id == other_user_id) & (Message.receiver_id == current_user.user_id),
            ),
        )
    )

    # Get latest messages (descending) then reverse for chronological order
    messages = (
        total_q
        .order_by(Message.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return list(reversed(messages))
