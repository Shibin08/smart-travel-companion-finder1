#!/usr/bin/env python3
"""Reseed backend database users from travel_companion_finder_dataset.csv."""

from __future__ import annotations

import argparse
import csv
import shutil
from datetime import datetime
from pathlib import Path
from typing import Iterable

from auth import hash_password
from config import DATABASE_URL
from database import SessionLocal, ensure_match_pair_guard
from models import EmergencyAlert, Match, Message, PlaceRequest, Review, ReviewVote, User
from photo_utils import get_default_photo

DEFAULT_DATASET = Path(__file__).resolve().parent / "travel_companion_finder_dataset.csv"
DEFAULT_PASSWORD = "test1234"


def _parse_date(value: str | None):
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _parse_int(value: str | None) -> int | None:
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def _budget_to_amount(value: str | None) -> float:
    if not value:
        return 8000.0
    raw = value.strip().lower()
    if raw == "low":
        return 5000.0
    if raw == "medium":
        return 8000.0
    if raw == "high":
        return 10000.0
    try:
        return float(raw)
    except ValueError:
        return 8000.0


def _normalize_style(value: str | None) -> str:
    raw = (value or "").strip()
    if raw.lower() == "backpacking":
        return "Backpacker"
    return raw or "Leisure"


def _normalize_gender(value: str | None) -> str:
    raw = (value or "").strip()
    if raw in {"Male", "Female", "Other", "Non-Binary"}:
        return raw
    return "Other"


def _normalize_personality(value: str | None) -> str | None:
    raw = (value or "").strip().lower()
    if raw == "introvert":
        return "Introvert"
    if raw == "extrovert":
        return "Extrovert"
    if raw == "ambivert":
        return "Ambivert"
    return None


def _resolve_sqlite_db_path() -> Path | None:
    if not DATABASE_URL.startswith("sqlite:///"):
        return None

    raw_path = DATABASE_URL[len("sqlite:///") :]
    if not raw_path:
        return None

    db_path = Path(raw_path)
    if db_path.is_absolute():
        return db_path
    return (Path(__file__).resolve().parent / db_path).resolve()


def _create_backup_if_possible() -> Path | None:
    db_path = _resolve_sqlite_db_path()
    if not db_path or not db_path.exists():
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_name(f"{db_path.name}.bak_reseed_{timestamp}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def _iter_rows(csv_path: Path) -> Iterable[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            yield row


def reseed(csv_path: Path, default_password: str, create_backup: bool = True) -> tuple[int, Path | None]:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")

    backup_path = _create_backup_if_possible() if create_backup else None
    session = SessionLocal()
    inserted = 0

    try:
        # Clear data in FK-safe order.
        session.query(ReviewVote).delete()
        session.query(Review).delete()
        session.query(Message).delete()
        session.query(Match).delete()
        session.query(EmergencyAlert).delete()
        session.query(PlaceRequest).delete()
        session.query(User).delete()
        session.commit()

        hashed_password = hash_password(default_password)
        seen_user_ids: set[str] = set()

        for row in _iter_rows(csv_path):
            user_id = (row.get("user_id") or "").strip()
            name = (row.get("name") or "").strip()
            if not user_id or not name or user_id in seen_user_ids:
                continue

            seen_user_ids.add(user_id)

            user = User(
                user_id=user_id,
                name=name,
                email=f"{user_id.lower()}@travelmatch.local",
                hashed_password=hashed_password,
                destination=(row.get("destination") or "").strip() or None,
                start_date=_parse_date(row.get("start_date")),
                end_date=_parse_date(row.get("end_date")),
                budget_range=_budget_to_amount(row.get("budget_range")),
                interests=(row.get("interests") or "").strip() or None,
                travel_style=_normalize_style(row.get("travel_style")),
                personality_type=_normalize_personality(row.get("personality_type")),
                language_preference=None,
                gender=_normalize_gender(row.get("gender")),
                age=_parse_int(row.get("age")),
                bio="Travel companion profile.",
                home_country=(row.get("home_country") or "").strip() or None,
                current_city=(row.get("current_location") or "").strip() or None,
                photo_url=get_default_photo(_normalize_gender(row.get("gender"))),
                discoverable=True,
            )
            session.add(user)
            inserted += 1

        session.commit()
        ensure_match_pair_guard()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return inserted, backup_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Reseed users table from dataset CSV.")
    parser.add_argument(
        "--csv",
        dest="csv_path",
        default=str(DEFAULT_DATASET),
        help="Path to dataset CSV (default: backend/travel_companion_finder_dataset.csv)",
    )
    parser.add_argument(
        "--password",
        dest="default_password",
        default=DEFAULT_PASSWORD,
        help=f"Default password assigned to seeded users (default: {DEFAULT_PASSWORD})",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip creating an automatic DB backup before reseed",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_path).resolve()
    inserted, backup_path = reseed(
        csv_path=csv_path,
        default_password=args.default_password,
        create_backup=not args.no_backup,
    )

    print(f"Reseed complete. Inserted users: {inserted}")
    if backup_path:
        print(f"Backup created: {backup_path}")
    print(f"Default seeded password: {args.default_password}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
