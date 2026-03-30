from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_user_personality_column() -> None:
    """Ensure users table has personality_type column for profile persistence."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("users")}
    if "personality_type" in existing_cols:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN personality_type VARCHAR"))


def ensure_match_pair_guard() -> None:
    """Ensure one unique match row per user pair (A,B == B,A)."""
    inspector = inspect(engine)
    if "matches" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        duplicate_rows = conn.execute(
            text(
                """
                SELECT m1.match_id
                FROM matches m1
                JOIN matches m2
                  ON (
                       (m1.user1_id = m2.user1_id AND m1.user2_id = m2.user2_id)
                       OR
                       (m1.user1_id = m2.user2_id AND m1.user2_id = m2.user1_id)
                     )
                 AND m1.match_id > m2.match_id
                """
            )
        ).fetchall()

        for row in duplicate_rows:
            conn.execute(
                text("DELETE FROM matches WHERE match_id = :match_id"),
                {"match_id": row[0]},
            )

        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_pair_expr
                ON matches (
                    CASE WHEN user1_id < user2_id THEN user1_id ELSE user2_id END,
                    CASE WHEN user1_id < user2_id THEN user2_id ELSE user1_id END
                )
                """
            )
        )


def ensure_match_trip_snapshot_columns() -> None:
    """Ensure match table keeps per-pair trip date snapshots."""
    inspector = inspect(engine)
    if "matches" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("matches")}
    required_columns = {
        "user1_trip_start_date": "DATETIME",
        "user1_trip_end_date": "DATETIME",
        "user2_trip_start_date": "DATETIME",
        "user2_trip_end_date": "DATETIME",
    }

    missing = [
        (name, col_type)
        for name, col_type in required_columns.items()
        if name not in existing_cols
    ]
    with engine.begin() as conn:
        for name, col_type in missing:
            conn.execute(text(f"ALTER TABLE matches ADD COLUMN {name} {col_type}"))

        # Backfill historical rows once: freeze match trip context using
        # the current user trip dates if snapshot fields are still empty.
        conn.execute(
            text(
                """
                UPDATE matches
                SET
                    user1_trip_start_date = COALESCE(
                        user1_trip_start_date,
                        (SELECT start_date FROM users WHERE users.user_id = matches.user1_id)
                    ),
                    user1_trip_end_date = COALESCE(
                        user1_trip_end_date,
                        (SELECT end_date FROM users WHERE users.user_id = matches.user1_id)
                    ),
                    user2_trip_start_date = COALESCE(
                        user2_trip_start_date,
                        (SELECT start_date FROM users WHERE users.user_id = matches.user2_id)
                    ),
                    user2_trip_end_date = COALESCE(
                        user2_trip_end_date,
                        (SELECT end_date FROM users WHERE users.user_id = matches.user2_id)
                    )
                WHERE
                    user1_trip_start_date IS NULL
                    OR user1_trip_end_date IS NULL
                    OR user2_trip_start_date IS NULL
                    OR user2_trip_end_date IS NULL
                """
            )
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
