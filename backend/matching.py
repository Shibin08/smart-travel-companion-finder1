"""
Matching logic for Smart Travel Companion Finder.

Weighted scoring criteria (total = 100):
    25 %  destination match
    20 %  date overlap
    20 %  budget similarity
    25 %  interest similarity (Jaccard)
    10 %  travel style match

All queries use SQLAlchemy sessions — no pandas or CSV.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from models import Match, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


# ──────────────────────────────
# Utility helpers
# ──────────────────────────────

def _norm(value) -> str:
    """Lower-case strip helper."""
    return str(value).strip().lower() if value else ""


def _to_float(value) -> float:
    """Convert a budget value (numeric or Low/Medium/High) to a float."""
    BUDGET_MAP = {"low": 5000, "medium": 8000, "high": 10000}
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = _norm(value)
        if cleaned in BUDGET_MAP:
            return BUDGET_MAP[cleaned]
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    return 0.0


def _jaccard(set1: set, set2: set) -> float:
    if not set1 or not set2:
        return 0.5          # neutral score when either side has no interests
    return len(set1 & set2) / len(set1 | set2)


def _date_overlap(start1, end1, start2, end2) -> float:
    """Return 0.0–1.0 ratio of overlapping days to the first user's trip.

    Returns 0.4 (partial credit) when dates don't overlap at all, since
    both users are still interested in the same destination.
    """
    try:
        if start1 is None or end1 is None or start2 is None or end2 is None:
            return 0.4  # unknown dates get partial credit
        if start1 > end2 or start2 > end1:
            return 0.4  # no overlap but same destination interest
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)
        overlap_days = (overlap_end - overlap_start).days + 1
        total_days = (end1 - start1).days + 1
        if total_days <= 0:
            return 0.4
        return max(overlap_days / total_days, 0.4)
    except Exception:
        return 0.4


def _budget_similarity(b1, b2) -> float:
    b1, b2 = _to_float(b1), _to_float(b2)
    if b1 == 0 or b2 == 0:
        return 0.0
    diff = abs(b1 - b2)
    return max(1 - diff / max(b1, b2), 0)


# ──────────────────────────────
# Scoring
# ──────────────────────────────

WEIGHTS = {
    "destination": 0.30,
    "dates": 0.15,
    "budget": 0.15,
    "interests": 0.20,
    "travel_style": 0.10,
    "base_bonus": 0.10,       # bonus for same destination
}


def calculate_score(user: dict, other: dict) -> float:
    """Return a weighted compatibility score on a 0–100 scale."""
    score = 0.0
    same_dest = _norm(user.get("destination")) == _norm(other.get("destination"))

    # Destination
    if same_dest:
        score += WEIGHTS["destination"]
        score += WEIGHTS["base_bonus"]    # extra bonus for matching destination

    # Date overlap
    score += WEIGHTS["dates"] * _date_overlap(
        user.get("start_date"), user.get("end_date"),
        other.get("start_date"), other.get("end_date"),
    )

    # Budget similarity
    score += WEIGHTS["budget"] * _budget_similarity(
        user.get("budget_range"), other.get("budget_range"),
    )

    # Interest similarity (pipe-delimited)
    u_int = {_norm(i) for i in str(user.get("interests", "")).split("|") if i.strip()}
    o_int = {_norm(i) for i in str(other.get("interests", "")).split("|") if i.strip()}
    score += WEIGHTS["interests"] * _jaccard(u_int, o_int)

    # Travel style (partial credit for different styles)
    if _norm(user.get("travel_style")) == _norm(other.get("travel_style")):
        score += WEIGHTS["travel_style"]
    else:
        score += WEIGHTS["travel_style"] * 0.4   # partial style credit

    return round(score * 100, 2)


# ──────────────────────────────
# User model → dict conversion
# ──────────────────────────────

def _user_to_dict(user: User) -> dict:
    """Convert a User ORM instance to a plain dict for scoring."""
    return {
        "user_id": user.user_id,
        "name": user.name,
        "destination": user.destination,
        "start_date": user.start_date,
        "end_date": user.end_date,
        "budget_range": user.budget_range,
        "interests": user.interests,
        "travel_style": user.travel_style,
    }


# ──────────────────────────────
# Public API
# ──────────────────────────────

def find_matches(
    current_user: User,
    db: "Session",
    top_n: int = 100,
    min_score: float = 20.0,
    trip_override: dict | None = None,
) -> list[dict]:
    """Find the best travel companions from the database.

    Args:
        current_user: The authenticated User ORM object.
        db: SQLAlchemy session.
        top_n: Number of top results to return (default 100).
        min_score: Minimum compatibility score to include.
        trip_override: Optional dict with search-time trip parameters
            (destination, start_date, end_date, budget_range, travel_style)
            that override the user's stored profile for this search.

    Returns:
        List of dicts with ``user_id``, ``name``, and
        ``compatibility_score``, sorted descending.
    """
    # Fetch all discoverable users except the current one
    candidates = (
        db.query(User)
        .filter(User.discoverable == True, User.user_id != current_user.user_id)
        .all()
    )

    user_dict = _user_to_dict(current_user)
    # Apply trip-level overrides from the frontend search form
    if trip_override:
        user_dict.update(trip_override)
    results: list[dict] = []

    for candidate in candidates:
        score = calculate_score(user_dict, _user_to_dict(candidate))
        if score >= min_score:
            results.append(
                {
                    "user_id": candidate.user_id,
                    "name": candidate.name,
                    "compatibility_score": score,
                    "photo_url": candidate.photo_url,
                    "gender": candidate.gender,
                }
            )

    results.sort(key=lambda r: r["compatibility_score"], reverse=True)
    return results[:top_n]


VALID_STATUSES = {"pending", "accepted", "rejected", "cancelled"}

# Allowed state transitions — terminal states have no outgoing edges
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending":   {"accepted", "rejected", "cancelled"},
    "accepted":  {"cancelled"},
    "rejected":  set(),   # terminal
    "cancelled": set(),   # terminal
}


def store_match(
    db: "Session",
    user1_id: str,
    user2_id: str,
    compatibility_score: float,
) -> tuple[Match, bool]:
    """Create a new match with status ``pending``.

    Performs a symmetrical duplicate check (user1↔user2).  If a match
    already exists between the two users the existing row is returned
    unchanged.

    Returns:
        A tuple of ``(match, created)`` where *created* is ``True`` when
        a new row was inserted and ``False`` when an existing one was
        returned.
    """
    existing = (
        db.query(Match)
        .filter(
            ((Match.user1_id == user1_id) & (Match.user2_id == user2_id))
            | ((Match.user1_id == user2_id) & (Match.user2_id == user1_id))
        )
        .first()
    )
    if existing:
        return existing, False

    new_match = Match(
        user1_id=user1_id,
        user2_id=user2_id,
        compatibility_score=compatibility_score,
        status="pending",
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    return new_match, True


def get_user_matches(
    db: Session,
    current_user_id: str,
    statuses: tuple[str, ...] = ("pending", "accepted"),
) -> list[dict]:
    """Return all matches for *current_user_id* whose status is in *statuses*.

    Uses SQLAlchemy joins to include the other user's basic info.
    """
    from models import Match, User
    from sqlalchemy import or_

    rows = (
        db.query(Match, User)
        .join(
            User,
            or_(
                (Match.user1_id == current_user_id) & (Match.user2_id == User.user_id),
                (Match.user2_id == current_user_id) & (Match.user1_id == User.user_id),
            ),
        )
        .filter(
            or_(
                Match.user1_id == current_user_id,
                Match.user2_id == current_user_id,
            ),
            Match.status.in_(statuses),
        )
        .order_by(Match.created_at.desc())
        .all()
    )

    results: list[dict] = []
    for match, other_user in rows:
        results.append(
            {
                "match_id": match.match_id,
                "compatibility_score": match.compatibility_score,
                "status": match.status,
                "created_at": match.created_at,
                "other_user": {
                    "user_id": other_user.user_id,
                    "name": other_user.name,
                },
            }
        )

    return results


def update_match_status(
    db: "Session",
    match_id: int,
    new_status: str,
    current_user_id: str,
) -> Match:
    """Transition a match to a new status.

    Args:
        db: SQLAlchemy session.
        match_id: Primary key of the match to update.
        new_status: Target status (pending / accepted / rejected / cancelled).
        current_user_id: The authenticated user requesting the change;
            must be one of the two matched users.

    Returns:
        The updated Match ORM object.

    Raises:
        ValueError: If the status is invalid, the match doesn't exist,
            or the user is not part of the match.
    """
    if new_status not in VALID_STATUSES:
        raise ValueError(
            f"Invalid status '{new_status}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}"
        )

    match = db.query(Match).filter(Match.match_id == match_id).first()
    if not match:
        raise ValueError("Match not found")

    # Only the two matched users may change the status
    if current_user_id not in (match.user1_id, match.user2_id):
        raise ValueError("You are not part of this match")

    # Enforce valid state transitions
    allowed = ALLOWED_TRANSITIONS.get(match.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{match.status}' to '{new_status}'"
        )

    match.status = new_status
    db.commit()
    db.refresh(match)
    return match
