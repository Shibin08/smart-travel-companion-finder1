from __future__ import annotations

import uuid
import unittest
from datetime import datetime, timedelta
from pathlib import Path
import sys

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


class CoreFlowSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, client=("smoke-test", 50000))
        cls.created_user_ids: set[str] = set()
        cls.created_match_ids: set[int] = set()

    @classmethod
    def tearDownClass(cls):
        if not cls.created_user_ids and not cls.created_match_ids:
            return

        session = SessionLocal()
        try:
            if cls.created_match_ids:
                session.query(Review).filter(Review.match_id.in_(cls.created_match_ids)).delete(synchronize_session=False)
                session.query(Message).filter(
                    or_(
                        Message.sender_id.in_(list(cls.created_user_ids)),
                        Message.receiver_id.in_(list(cls.created_user_ids)),
                    )
                ).delete(synchronize_session=False)
                session.query(Match).filter(Match.match_id.in_(list(cls.created_match_ids))).delete(synchronize_session=False)

            if cls.created_user_ids:
                session.query(User).filter(User.user_id.in_(list(cls.created_user_ids))).delete(synchronize_session=False)

            session.commit()
        finally:
            session.close()
            engine.dispose()

    def _register_user(self, user_id: str, email: str, name: str, start_date: str, end_date: str, password: str):
        payload = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password": password,
            "gender": "Other",
            "destination": "Goa",
            "start_date": start_date,
            "end_date": end_date,
            "budget_range": 8000,
            "interests": "food,culture",
            "travel_style": "Leisure",
            "discoverable": True,
        }
        res = self.client.post("/register", json=payload)
        self.assertEqual(res.status_code, 200, msg=res.text)
        self.created_user_ids.add(user_id)

    def _login(self, email: str, password: str) -> str:
        res = self.client.post("/login", data={"username": email, "password": password})
        self.assertEqual(res.status_code, 200, msg=res.text)
        token = res.json().get("access_token")
        self.assertTrue(token)
        return token

    def test_recommend_connect_accept_chat_end_chat_flow(self):
        now = datetime.now()
        future_start = _iso_day(now + timedelta(days=7))
        future_end = _iso_day(now + timedelta(days=12))
        password = "test123456"

        uid1 = f"smoke_{uuid.uuid4().hex[:8]}"
        uid2 = f"smoke_{uuid.uuid4().hex[:8]}"
        email1 = f"{uid1}@example.com"
        email2 = f"{uid2}@example.com"

        self._register_user(uid1, email1, "Smoke Sender", future_start, future_end, password)
        self._register_user(uid2, email2, "Smoke Receiver", future_start, future_end, password)

        token1 = self._login(email1, password)
        token2 = self._login(email2, password)
        h1 = {"Authorization": f"Bearer {token1}"}
        h2 = {"Authorization": f"Bearer {token2}"}

        rec = self.client.post(
            "/recommend",
            headers=h1,
            json={
                "destination": "Goa",
                "start_date": future_start,
                "end_date": future_end,
                "budget": "Medium",
                "travel_style": "Leisure",
            },
        )
        self.assertEqual(rec.status_code, 200, msg=rec.text)
        self.assertIn("matches", rec.json())

        create_match = self.client.post(
            "/matches/accept",
            headers=h1,
            json={"matched_user_id": uid2, "compatibility_score": 72.5},
        )
        self.assertEqual(create_match.status_code, 201, msg=create_match.text)
        match_id = create_match.json()["match_id"]
        self.created_match_ids.add(match_id)

        # Duplicate request should not create a second row.
        create_match_again = self.client.post(
            "/matches/accept",
            headers=h1,
            json={"matched_user_id": uid2, "compatibility_score": 72.5},
        )
        self.assertEqual(create_match_again.status_code, 201, msg=create_match_again.text)
        self.assertEqual(create_match_again.json()["match_id"], match_id)

        session = SessionLocal()
        try:
            pair_rows = (
                session.query(Match)
                .filter(
                    or_(
                        (Match.user1_id == uid1) & (Match.user2_id == uid2),
                        (Match.user1_id == uid2) & (Match.user2_id == uid1),
                    )
                )
                .count()
            )
            self.assertEqual(pair_rows, 1)
        finally:
            session.close()

        sender_accept = self.client.patch(
            f"/matches/{match_id}/status",
            headers=h1,
            json={"status": "accepted"},
        )
        self.assertEqual(sender_accept.status_code, 403, msg=sender_accept.text)

        receiver_accept = self.client.patch(
            f"/matches/{match_id}/status",
            headers=h2,
            json={"status": "accepted"},
        )
        self.assertEqual(receiver_accept.status_code, 200, msg=receiver_accept.text)

        send_msg = self.client.post(
            "/chat/send",
            headers=h1,
            json={"receiver_id": uid2, "message_text": "hello smoke test"},
        )
        self.assertEqual(send_msg.status_code, 200, msg=send_msg.text)

        conv = self.client.get("/chat/conversations", headers=h1)
        self.assertEqual(conv.status_code, 200, msg=conv.text)
        self.assertTrue(any(item.get("user_id") == uid2 for item in conv.json()))

        early_end = self.client.patch(
            f"/matches/{match_id}/status",
            headers=h1,
            json={"status": "cancelled"},
        )
        self.assertEqual(early_end.status_code, 400, msg=early_end.text)

        # Move both trips into the past to unlock end-chat.
        session = SessionLocal()
        try:
            yday = datetime.now() - timedelta(days=1)
            u1 = session.query(User).filter(User.user_id == uid1).first()
            u2 = session.query(User).filter(User.user_id == uid2).first()
            self.assertIsNotNone(u1)
            self.assertIsNotNone(u2)
            u1.end_date = yday
            u2.end_date = yday
            session.commit()
        finally:
            session.close()

        end_ok = self.client.patch(
            f"/matches/{match_id}/status",
            headers=h1,
            json={"status": "cancelled"},
        )
        self.assertEqual(end_ok.status_code, 200, msg=end_ok.text)

        blocked_after_end = self.client.post(
            "/chat/send",
            headers=h1,
            json={"receiver_id": uid2, "message_text": "should fail"},
        )
        self.assertEqual(blocked_after_end.status_code, 403, msg=blocked_after_end.text)


if __name__ == "__main__":
    unittest.main()
