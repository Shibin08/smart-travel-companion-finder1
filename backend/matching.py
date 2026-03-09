"""
Matching logic for Smart Travel Companion Finder.

Weighted scoring criteria (total = 100):
    14 %  destination match
    23 %  date overlap
    14 %  budget similarity
    18 %  interest similarity (Jaccard)
    23 %  travel style similarity (matrix-based)
     8 %  age proximity (soft penalty for large gaps)

All queries use SQLAlchemy sessions - no pandas or CSV.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from models import Match, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from sqlalchemy import or_


# Utility helpers

# Values that represent "no destination set" - treated as empty
_NO_DEST = {"", "not set", "none", "null", "n/a"}


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
        return 0.3  # low-neutral score when either side has no interests
    return len(set1 & set2) / len(set1 | set2)


# Travel-style similarity matrix.
# Symmetric lookup - keys are sorted alphabetically.
_STYLE_SIM: dict[tuple[str, str], float] = {
    ("adventure", "backpacker"): 0.80,
    ("adventure", "business"): 0.15,
    ("adventure", "leisure"): 0.45,
    ("adventure", "luxury"): 0.25,
    ("adventure", "standard"): 0.35,
    ("backpacker", "business"): 0.10,
    ("backpacker", "leisure"): 0.25,
    ("backpacker", "luxury"): 0.10,
    ("backpacker", "standard"): 0.20,
    ("business", "leisure"): 0.50,
    ("business", "luxury"): 0.65,
    ("business", "standard"): 0.70,
    ("leisure", "luxury"): 0.70,
    ("leisure", "standard"): 0.80,
    ("luxury", "standard"): 0.65,
}


def _style_similarity(s1: str, s2: str) -> float:
    """Return 0.0-1.0 similarity between two travel styles."""
    a, b = _norm(s1), _norm(s2)
    if not a or not b:
        return 0.2  # unknown style -> minimal credit
    if a == b:
        return 1.0
    key = tuple(sorted((a, b)))
    return _STYLE_SIM.get(key, 0.15)  # fallback for unlisted pairs


def _date_overlap(start1, end1, start2, end2) -> float:
    """Return 0.0-1.0 ratio of overlapping days to the first user's trip.

    Returns 0.0 when dates don't overlap at all so that date changes
    meaningfully affect the match count and ranking.
    Returns 0.0 when the *candidate* has unknown dates (so they don't
    appear in every result). Returns 0.2 only when the *searcher*
    has unknown dates.
    """
    try:
        # Candidate has no dates -> exclude them from date-filtered searches
        if start2 is None or end2 is None:
            return 0.0
        # Searcher has no dates -> small partial credit
        if start1 is None or end1 is None:
            return 0.2
        if start1 > end2 or start2 > end1:
            return 0.0  # no overlap = no date credit
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)
        overlap_days = (overlap_end - overlap_start).days + 1
        total_days = (end1 - start1).days + 1
        if total_days <= 0:
            return 0.0
        return overlap_days / total_days
    except Exception:
        return 0.0


def _budget_similarity(b1, b2) -> float:
    b1, b2 = _to_float(b1), _to_float(b2)
    if b1 == 0 or b2 == 0:
        return 0.0
    diff = abs(b1 - b2)
    return max(1 - diff / max(b1, b2), 0)


def _age_proximity(age1, age2) -> float:
    """Return 0.0-1.0 score based on age gap.

    Same age -> 1.0, 5-year gap -> 0.75, 10-year gap -> 0.5,
    20-year gap -> 0.0. Unknown ages -> neutral 0.5.
    """
    try:
        a1, a2 = int(age1), int(age2)
    except (TypeError, ValueError):
        return 0.5  # unknown age -> neutral
    if a1 <= 0 or a2 <= 0:
        return 0.5  # age not set -> neutral
    gap = abs(a1 - a2)
    # Linear decay: 0 gap -> 1.0, 20+ gap -> 0.0
    return max(1.0 - gap / 20.0, 0.0)


# Scoring

WEIGHTS = {
    "destination": 0.14,
    "dates": 0.23,
    "budget": 0.14,
    "interests": 0.18,
    "travel_style": 0.23,
    "age": 0.08,
}


def calculate_score(user: dict, other: dict) -> dict:
    """Return a weighted compatibility score on a 0-100 scale with component breakdown."""
    same_dest = _norm(user.get("destination")) == _norm(other.get("destination"))

    # Individual raw scores (0.0-1.0)
    dest_raw = 1.0 if same_dest else 0.0

    dates_raw = _date_overlap(
        user.get("start_date"),
        user.get("end_date"),
        other.get("start_date"),
        other.get("end_date"),
    )

    budget_raw = _budget_similarity(
        user.get("budget_range"),
        other.get("budget_range"),
    )

    u_int = {_norm(i) for i in re.split(r"[|,]", str(user.get("interests", ""))) if i.strip()}
    o_int = {_norm(i) for i in re.split(r"[|,]", str(other.get("interests", ""))) if i.strip()}
    interests_raw = _jaccard(u_int, o_int)

    style_raw = _style_similarity(
        user.get("travel_style", ""),
        other.get("travel_style", ""),
    )

    age_raw = _age_proximity(
        user.get("age"),
        other.get("age"),
    )

    # Weighted sum
    overall = (
        WEIGHTS["destination"] * dest_raw
        + WEIGHTS["dates"] * dates_raw
        + WEIGHTS["budget"] * budget_raw
        + WEIGHTS["interests"] * interests_raw
        + WEIGHTS["travel_style"] * style_raw
        + WEIGHTS["age"] * age_raw
    )

    return {
        "overall": round(overall * 100, 2),
        "destination": round(dest_raw, 2),
        "dates": round(dates_raw, 2),
        "budget": round(budget_raw, 2),
        "interests": round(interests_raw, 2),
        "travel_style": round(style_raw, 2),
        "age": round(age_raw, 2),
    }


# User model -> dict conversion


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
        "age": user.age,
    }


# Public API


def find_matches(
    current_user: User,
    db: "Session",
    top_n: int = 100,
    min_score: float = 30.0,
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
    # Pre-filter by destination when the user has one - this makes date
    # changes meaningfully affect the result count instead of scoring
    # every user in the database.
    user_dict = _user_to_dict(current_user)
    # Apply trip-level overrides from the frontend search form
    if trip_override:
        user_dict.update(trip_override)

    query = db.query(User).filter(
        User.discoverable == True,
        User.user_id != current_user.user_id,
    )

    # Exclude users who haven't set a real destination (e.g. "Not set", NULL)
    query = query.filter(
        User.destination.isnot(None),
        ~User.destination.in_(["", "Not set", "not set", "None", "null", "N/A"]),
    )

    # Exclude users the current user has already matched with (any status)
    already_matched_ids = {
        row[0]
        for row in db.query(Match.user2_id).filter(Match.user1_id == current_user.user_id).all()
    } | {
        row[0]
        for row in db.query(Match.user1_id).filter(Match.user2_id == current_user.user_id).all()
    }
    if already_matched_ids:
        query = query.filter(~User.user_id.in_(already_matched_ids))

    search_dest = _norm(user_dict.get("destination"))
    if search_dest and search_dest not in _NO_DEST:
        query = query.filter(User.destination.ilike(search_dest))

    candidates = query.all()

    # Hard date-overlap filter: when the searcher specifies dates,
    # skip candidates whose dates don't overlap at all. This is what
    # makes adding 2 extra travel days actually change the match list.
    has_dates = user_dict.get("start_date") and user_dict.get("end_date")

    results: list[dict] = []

    for candidate in candidates:
        cand_dict = _user_to_dict(candidate)

        # Exclude candidates with confirmed zero date overlap
        if has_dates:
            overlap = _date_overlap(
                user_dict["start_date"],
                user_dict["end_date"],
                cand_dict.get("start_date"),
                cand_dict.get("end_date"),
            )
            if overlap == 0.0:
                continue

        score_data = calculate_score(user_dict, cand_dict)
        if score_data["overall"] >= min_score:
            results.append(
                {
                    "user_id": candidate.user_id,
                    "name": candidate.name,
                    "compatibility_score": score_data["overall"],
                    "score_breakdown": {
                        "destination": score_data["destination"],
                        "dates": score_data["dates"],
                        "budget": score_data["budget"],
                        "interests": score_data["interests"],
                        "travel_style": score_data["travel_style"],
                        "age": score_data["age"],
                    },
                    "photo_url": candidate.photo_url,
                    "gender": candidate.gender,
                    "age": candidate.age,
                    "travel_style": candidate.travel_style,
                    "interests": candidate.interests,
                    "budget_range": candidate.budget_range,
                    "home_country": candidate.home_country,
                    "current_city": candidate.current_city,
                    "bio": candidate.bio,
                }
            )

    results.sort(key=lambda r: r["compatibility_score"], reverse=True)
    return results[:top_n]


VALID_STATUSES = {"pending", "accepted", "rejected", "cancelled"}

# Allowed state transitions - terminal states have no outgoing edges
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"accepted", "rejected", "cancelled"},
    "accepted": {"cancelled"},
    "rejected": set(),  # terminal
    "cancelled": set(),  # terminal
}


def store_match(
    db: "Session",
    user1_id: str,
    user2_id: str,
    compatibility_score: float,
) -> tuple[Match, bool]:
    """Create a new match with status ``pending``.

    Performs a symmetrical duplicate check (user1<->user2). If a match
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
                    "photo_url": other_user.photo_url,
                    "gender": other_user.gender,
                    "age": other_user.age,
                    "travel_style": other_user.travel_style,
                    "interests": other_user.interests,
                    "budget_range": other_user.budget_range,
                    "home_country": other_user.home_country,
                    "current_city": other_user.current_city,
                    "bio": other_user.bio,
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
