from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
