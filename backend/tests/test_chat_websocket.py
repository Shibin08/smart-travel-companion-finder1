from __future__ import annotations

import sys
import unittest
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi.testclient import TestClient
from sqlalchemy import or_

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402
from database import SessionLocal, engine  # noqa: E402
from models import Match, Message, Review, User  # noqa: E402


def _iso_day(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT00:00:00")


class ChatWebSocketTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, client=("ws-test", 50002))
        cls.created_user_ids: set[str] = set()
        cls.created_match_ids: set[int] = set()

    @classmethod
    def tearDownClass(cls):
        session = SessionLocal()
        try:
            if cls.created_match_ids:
                session.query(Review).filter(Review.match_id.in_(list(cls.created_match_ids))).delete(
                    synchronize_session=False
                )

            if cls.created_user_ids:
                session.query(Message).filter(
                    or_(
                        Message.sender_id.in_(list(cls.created_user_ids)),
                        Message.receiver_id.in_(list(cls.created_user_ids)),
                    )
                ).delete(synchronize_session=False)
                session.query(Match).filter(
                    or_(
                        Match.user1_id.in_(list(cls.created_user_ids)),
                        Match.user2_id.in_(list(cls.created_user_ids)),
                    )
                ).delete(synchronize_session=False)
                session.query(User).filter(User.user_id.in_(list(cls.created_user_ids))).delete(
                    synchronize_session=False
                )

            session.commit()
        finally:
            session.close()
            engine.dispose()

    def _register_user(self, user_id: str, email: str, name: str, start_date: str, end_date: str):
        payload = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password": "test123456",
            "gender": "Other",
            "destination": "Goa",
            "start_date": start_date,
            "end_date": end_date,
            "budget_range": 8000,
            "interests": "food,culture",
            "travel_style": "Leisure",
            "discoverable": True,
        }
        response = self.client.post("/register", json=payload)
        self.assertEqual(response.status_code, 200, msg=response.text)
        self.created_user_ids.add(user_id)

    def _login(self, email: str) -> str:
        response = self.client.post(
            "/login",
            data={"username": email, "password": "test123456"},
        )
        self.assertEqual(response.status_code, 200, msg=response.text)
        return response.json()["access_token"]

    def _receive_until_type(self, websocket, event_type: str):
        for _ in range(5):
            payload = websocket.receive_json()
            if payload.get("type") == event_type:
                return payload
        self.fail(f"Did not receive websocket event '{event_type}'")

    def test_websocket_chat_broadcasts_and_persists(self):
        now = datetime.now()
        future_start = _iso_day(now + timedelta(days=9))
        future_end = _iso_day(now + timedelta(days=14))

        uid1 = f"ws_{uuid.uuid4().hex[:8]}"
        uid2 = f"ws_{uuid.uuid4().hex[:8]}"
        email1 = f"{uid1}@example.com"
        email2 = f"{uid2}@example.com"

        self._register_user(uid1, email1, "WebSocket Sender", future_start, future_end)
        self._register_user(uid2, email2, "WebSocket Receiver", future_start, future_end)

        token1 = self._login(email1)
        token2 = self._login(email2)
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        create_match = self.client.post(
            "/matches/accept",
            headers=headers1,
            json={"matched_user_id": uid2, "compatibility_score": 82},
        )
        self.assertEqual(create_match.status_code, 201, msg=create_match.text)
        match_id = create_match.json()["match_id"]
        self.created_match_ids.add(match_id)

        accept_match = self.client.patch(
            f"/matches/{match_id}/status",
            headers=headers2,
            json={"status": "accepted"},
        )
        self.assertEqual(accept_match.status_code, 200, msg=accept_match.text)

        with self.client.websocket_connect(f"/chat/ws?token={quote(token1)}") as ws1:
            with self.client.websocket_connect(f"/chat/ws?token={quote(token2)}") as ws2:
                self._receive_until_type(ws1, "connected")
                self._receive_until_type(ws2, "connected")

                ws1.send_json(
                    {
                        "type": "typing",
                        "receiver_id": uid2,
                        "is_typing": True,
                    }
                )

                ws1.send_json({"type": "ping"})
                self._receive_until_type(ws1, "pong")
                typing_event = self._receive_until_type(ws2, "typing")
                self.assertEqual(typing_event["sender_id"], uid1)
                self.assertEqual(typing_event["receiver_id"], uid2)
                self.assertTrue(typing_event["is_typing"])

                ws1.send_json(
                    {
                        "type": "send_message",
                        "receiver_id": uid2,
                        "message_text": "hello realtime",
                        "client_message_id": "client-ws-1",
                    }
                )

                sender_event = self._receive_until_type(ws1, "chat_message")
                receiver_event = self._receive_until_type(ws2, "chat_message")

                self.assertEqual(sender_event["message"]["message_text"], "hello realtime")
                self.assertEqual(receiver_event["message"]["message_text"], "hello realtime")
                self.assertEqual(sender_event["client_message_id"], "client-ws-1")
                self.assertEqual(receiver_event["conversation"]["user_id"], uid1)

        conversation = self.client.get(f"/chat/{uid2}", headers=headers1)
        self.assertEqual(conversation.status_code, 200, msg=conversation.text)
        messages = conversation.json()
        self.assertTrue(messages)
        self.assertEqual(messages[-1]["message_text"], "hello realtime")


if __name__ == "__main__":
    unittest.main()
