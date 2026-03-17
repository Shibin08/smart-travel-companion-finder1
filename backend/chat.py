"""
Chat endpoints for Smart Travel Companion Finder.

POST /chat/send            - Send a message (requires accepted match)
GET  /chat/conversations   - List all conversation partners with last message
GET  /chat/{other_user_id} - Retrieve conversation history (paginated)
WS   /chat/ws              - Realtime chat events for the authenticated user
"""

from __future__ import annotations

from typing import Any

from anyio import from_thread
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from auth import get_current_user, get_current_user_from_token
from database import SessionLocal, get_db
from models import Match, Message, User
from schemas import ChatMessageCreate, ChatMessageResponse, ConversationSummary

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatConnectionManager:
    """Tracks active realtime chat connections by authenticated user id."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if not sockets:
            return

        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def send_json(self, user_id: str, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in list(self._connections.get(user_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        for websocket in stale:
            self.disconnect(user_id, websocket)


chat_manager = ChatConnectionManager()


def _serialize_timestamp(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _serialize_chat_message(message: Message) -> dict[str, Any]:
    return {
        "message_id": message.message_id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "message_text": message.message_text,
        "timestamp": _serialize_timestamp(message.timestamp),
    }


def _build_conversation_summary(
    *,
    other_user: User,
    message: Message,
) -> dict[str, Any]:
    return {
        "user_id": other_user.user_id,
        "name": other_user.name,
        "last_message": message.message_text,
        "last_message_timestamp": _serialize_timestamp(message.timestamp),
    }


def _get_accepted_match(db: Session, user_id: str, other_user_id: str) -> Match | None:
    return (
        db.query(Match)
        .filter(
            Match.status == "accepted",
            or_(
                (Match.user1_id == user_id) & (Match.user2_id == other_user_id),
                (Match.user1_id == other_user_id) & (Match.user2_id == user_id),
            ),
        )
        .first()
    )


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _resolve_chat_receiver(
    *,
    db: Session,
    sender: User,
    receiver_id: str,
) -> User:
    normalized_receiver_id = receiver_id.strip()
    if normalized_receiver_id == sender.user_id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    receiver = db.query(User).filter(User.user_id == normalized_receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    accepted_match = _get_accepted_match(db, sender.user_id, receiver.user_id)
    if not accepted_match:
        raise HTTPException(
            status_code=403,
            detail="You can only message users with an accepted match",
        )

    return receiver


def _create_chat_message(
    *,
    db: Session,
    sender: User,
    receiver_id: str,
    message_text: str,
) -> tuple[Message, User]:
    body = ChatMessageCreate(
        receiver_id=receiver_id.strip(),
        message_text=message_text.strip(),
    )
    receiver = _resolve_chat_receiver(
        db=db,
        sender=sender,
        receiver_id=body.receiver_id,
    )

    message = Message(
        sender_id=sender.user_id,
        receiver_id=receiver.user_id,
        message_text=body.message_text,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message, receiver


async def _broadcast_chat_message(
    message: Message,
    sender: User,
    receiver: User,
    client_message_id: str | None = None,
) -> None:
    base_payload = {
        "type": "chat_message",
        "message": _serialize_chat_message(message),
    }
    if client_message_id:
        base_payload["client_message_id"] = client_message_id

    sender_payload = dict(base_payload)
    sender_payload["conversation"] = _build_conversation_summary(
        other_user=receiver,
        message=message,
    )
    await chat_manager.send_json(sender.user_id, sender_payload)

    receiver_payload = dict(base_payload)
    receiver_payload["conversation"] = _build_conversation_summary(
        other_user=sender,
        message=message,
    )
    await chat_manager.send_json(receiver.user_id, receiver_payload)


async def _broadcast_typing_state(
    *,
    sender: User,
    receiver: User,
    is_typing: bool,
) -> None:
    await chat_manager.send_json(
        receiver.user_id,
        {
            "type": "typing",
            "sender_id": sender.user_id,
            "receiver_id": receiver.user_id,
            "is_typing": is_typing,
        },
    )


@router.post("/send", response_model=ChatMessageResponse)
def send_message(
    body: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message to another user.

    Only allowed when an accepted match exists between the two users.
    """
    message, receiver = _create_chat_message(
        db=db,
        sender=current_user,
        receiver_id=body.receiver_id,
        message_text=body.message_text,
    )
    from_thread.run(
        _broadcast_chat_message,
        message,
        current_user,
        receiver,
    )
    return message


@router.get("/conversations", response_model=list[ConversationSummary])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the latest message per active conversation partner."""

    uid = current_user.user_id

    active_partner_ids = set()
    active_matches = (
        db.query(Match.user1_id, Match.user2_id)
        .filter(
            Match.status == "accepted",
            or_(Match.user1_id == uid, Match.user2_id == uid),
        )
        .all()
    )
    for user1_id, user2_id in active_matches:
        other_id = user2_id if user1_id == uid else user1_id
        active_partner_ids.add(other_id)

    if not active_partner_ids:
        return []

    other_id = case(
        (Message.sender_id == uid, Message.receiver_id),
        else_=Message.sender_id,
    ).label("other_id")

    sub = (
        db.query(
            other_id,
            func.max(Message.message_id).label("last_msg_id"),
        )
        .filter(
            or_(Message.sender_id == uid, Message.receiver_id == uid),
            other_id.in_(list(active_partner_ids)),
        )
        .group_by(other_id)
        .subquery()
    )

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


@router.get("/{other_user_id}", response_model=list[ChatMessageResponse])
def get_conversation(
    other_user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a paginated conversation in ascending timestamp order."""

    match = _get_accepted_match(db, current_user.user_id, other_user_id)
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

    messages = (
        total_q
        .order_by(Message.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return list(reversed(messages))


@router.websocket("/ws")
async def chat_websocket(websocket: WebSocket) -> None:
    """Realtime chat connection for the authenticated user."""

    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    current_user: User | None = None

    try:
        current_user = get_current_user_from_token(token, db)
    except HTTPException:
        db.close()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await chat_manager.connect(current_user.user_id, websocket)
    await websocket.send_json(
        {
            "type": "connected",
            "user_id": current_user.user_id,
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = str(payload.get("type") or "").strip().lower()

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type == "typing":
                receiver_id = str(payload.get("receiver_id") or "").strip()
                if not receiver_id:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "receiver_id is required for typing events",
                        }
                    )
                    continue

                try:
                    receiver = _resolve_chat_receiver(
                        db=db,
                        sender=current_user,
                        receiver_id=receiver_id,
                    )
                except HTTPException as exc:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": exc.detail,
                        }
                    )
                    continue

                await _broadcast_typing_state(
                    sender=current_user,
                    receiver=receiver,
                    is_typing=_coerce_bool(payload.get("is_typing")),
                )
                continue

            if event_type != "send_message":
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Unsupported chat event type",
                    }
                )
                continue

            receiver_id = str(payload.get("receiver_id") or "").strip()
            message_text = str(payload.get("message_text") or "").strip()
            client_message_id = str(payload.get("client_message_id") or "").strip() or None

            if not receiver_id or not message_text:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "receiver_id and message_text are required",
                        "client_message_id": client_message_id,
                    }
                )
                continue

            try:
                message, receiver = _create_chat_message(
                    db=db,
                    sender=current_user,
                    receiver_id=receiver_id,
                    message_text=message_text,
                )
            except HTTPException as exc:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": exc.detail,
                        "client_message_id": client_message_id,
                    }
                )
                continue

            await _broadcast_chat_message(
                message,
                current_user,
                receiver,
                client_message_id,
            )
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(current_user.user_id, websocket)
        db.close()
