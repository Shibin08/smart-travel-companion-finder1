from __future__ import annotations

import sys
import unittest
import uuid
from datetime import datetime, timedelta
from pathlib import Path

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


class RecommendationFilterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, client=("filter-test", 50001))
        cls.created_user_ids: set[str] = set()

    @classmethod
    def tearDownClass(cls):
        if not cls.created_user_ids:
            return

        session = SessionLocal()
        try:
            session.query(Review).filter(
                or_(
                    Review.reviewer_id.in_(list(cls.created_user_ids)),
                    Review.reviewee_id.in_(list(cls.created_user_ids)),
                )
            ).delete(synchronize_session=False)
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

    def test_recommendations_skip_internal_test_accounts(self):
        now = datetime.now()
        future_start = _iso_day(now + timedelta(days=10))
        future_end = _iso_day(now + timedelta(days=15))

        seeker_id = f"filter_{uuid.uuid4().hex[:8]}"
        visible_id = f"visible_{uuid.uuid4().hex[:8]}"
        hidden_id = f"qc_{uuid.uuid4().hex[:8]}"

        seeker_email = f"{seeker_id}@example.com"
        visible_email = f"{visible_id}@example.com"
        hidden_email = f"{hidden_id}@example.com"

        self._register_user(seeker_id, seeker_email, "Filter Seeker", future_start, future_end)
        self._register_user(visible_id, visible_email, "Aarav", future_start, future_end)
        self._register_user(hidden_id, hidden_email, "QC Hidden", future_start, future_end)

        login = self.client.post(
            "/login",
            data={"username": seeker_email, "password": "test123456"},
        )
        self.assertEqual(login.status_code, 200, msg=login.text)
        token = login.json()["access_token"]

        recommendations = self.client.post(
            "/recommend",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "destination": "Goa",
                "start_date": future_start,
                "end_date": future_end,
                "budget": "Medium",
                "travel_style": "Leisure",
            },
        )
        self.assertEqual(recommendations.status_code, 200, msg=recommendations.text)

        match_ids = {item["user_id"] for item in recommendations.json()["matches"]}
        self.assertIn(visible_id, match_ids)
        self.assertNotIn(hidden_id, match_ids)


if __name__ == "__main__":
    unittest.main()
