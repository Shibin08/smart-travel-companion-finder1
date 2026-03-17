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

from datetime import date as _date
from datetime import datetime as _dt
import re
from typing import TYPE_CHECKING

from models import Match, Review, User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError


# Utility helpers

# Values that represent "no destination set" - treated as empty
_NO_DEST = {"", "not set", "none", "null", "n/a"}

# Canonical travel-style aliases to keep strict filtering and scoring
# consistent with frontend labels and dataset values.
_STYLE_ALIASES = {
    "backpacking": "backpacker",
    "standard": "leisure",
}

_TEST_USER_ID_PREFIXES = ("qc", "smoke", "pw_")
_TEST_NAME_PREFIXES = ("qc ", "smoke ", "pw ")


def _norm(value) -> str:
    """Lower-case strip helper."""
    return str(value).strip().lower() if value else ""


def _canon_style(value) -> str:
    """Normalize travel-style labels to canonical values."""
    style = _norm(value)
    if not style:
        return ""
    return _STYLE_ALIASES.get(style, style)


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


def _budget_band(value) -> str:
    """Map numeric/string budget to low/medium/high band."""
    amount = _to_float(value)
    if amount <= 0:
        return ""
    if amount < 7000:
        return "low"
    # Keep these thresholds aligned with frontend budget labels
    # (>=9000 is shown as High in the UI).
    if amount < 9000:
        return "medium"
    return "high"


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
    a, b = _canon_style(s1), _canon_style(s2)
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


def _coerce_to_date(value):
    """Best-effort conversion of ORM/string date values to ``date``."""
    if value is None:
        return None
    if isinstance(value, _dt):
        return value.date()
    if isinstance(value, _date):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        for parser in (
            lambda v: _dt.fromisoformat(v).date(),
            lambda v: _dt.strptime(v, "%Y-%m-%d").date(),
            lambda v: _dt.strptime(v, "%d-%m-%Y").date(),
            lambda v: _dt.strptime(v, "%Y-%m-%d %H:%M:%S").date(),
        ):
            try:
                return parser(text)
            except ValueError:
                continue
    return None


def _is_trip_completed_for_pair(end_date_1, end_date_2) -> bool:
    """Return True only when both users have ended their trips (<= today)."""
    d1 = _coerce_to_date(end_date_1)
    d2 = _coerce_to_date(end_date_2)
    if d1 is None or d2 is None:
        return False
    today = _date.today()
    return d1 <= today and d2 <= today


def _end_chat_available_on(end_date_1, end_date_2):
    """Return the date when end-chat becomes available for both users."""
    d1 = _coerce_to_date(end_date_1)
    d2 = _coerce_to_date(end_date_2)
    if d1 is None or d2 is None:
        return None
    return max(d1, d2)


_BIO_TRAITS = [
    "calm",
    "curious",
    "steady",
    "vibrant",
    "friendly",
    "bold",
    "mindful",
    "social",
    "open",
    "joyful",
    "grounded",
    "active",
    "relaxed",
    "thoughtful",
    "creative",
    "easygoing",
    "adaptable",
    "focused",
    "spirited",
    "warm",
    "confident",
    "balanced",
    "flexible",
    "positive",
    "energetic",
]

_BIO_MODES = [
    "planner",
    "explorer",
    "navigator",
    "story-seeker",
    "culture-fan",
    "route-builder",
    "trip-partner",
    "sunrise-chaser",
    "mountain-lover",
    "foodie-traveler",
    "city-walker",
    "weekend-drifter",
    "itinerary-pro",
    "adventure-friend",
    "budget-smart traveler",
    "comfort-first traveler",
    "local-guide vibe",
    "nature-first traveler",
    "museum-hopper",
    "coastal wanderer",
    "photowalk fan",
    "slow-travel fan",
    "group-trip friend",
    "solo-to-group traveler",
    "sunset-hunter",
]


def _split_interests(raw_value) -> list[str]:
    if raw_value is None:
        return []
    raw_items = [item.strip() for item in re.split(r"[|,]", str(raw_value)) if item.strip()]
    unique_items: list[str] = []
    seen: set[str] = set()
    for item in raw_items:
        key = _norm(item)
        if key and key not in seen:
            seen.add(key)
            unique_items.append(item)
    return unique_items


def _stable_user_index(user_id: str) -> int:
    match = re.search(r"(\d+)$", str(user_id or ""))
    if match:
        return max(int(match.group(1)) - 1, 0)
    # Deterministic fallback when user_id has no numeric suffix.
    return sum((idx + 1) * ord(ch) for idx, ch in enumerate(str(user_id or "")))


def _bio_signature(user_id: str) -> str:
    idx = _stable_user_index(user_id)
    trait = _BIO_TRAITS[idx % len(_BIO_TRAITS)]
    mode = _BIO_MODES[(idx // len(_BIO_TRAITS)) % len(_BIO_MODES)]
    return f"{trait} {mode}"


def _display_location(user: User) -> str:
    city = str(user.current_city or "").strip()
    if city and _norm(city) not in {"unknown", "abroad"}:
        return city
    country = str(user.home_country or "").strip()
    if country and _norm(country) not in _NO_DEST:
        return country
    return "India"


def _build_unique_bio(user: User) -> str:
    idx = _stable_user_index(user.user_id)
    style = str(user.travel_style or "").strip() or "Travel"
    style_lower = style.lower()
    location = _display_location(user)
    interests = _split_interests(user.interests)
    if len(interests) >= 2:
        interests_text = f"{interests[0].lower()} and {interests[1].lower()}"
    elif len(interests) == 1:
        interests_text = interests[0].lower()
    else:
        interests_text = "new places"

    destination = str(user.destination or "").strip()
    destination_text = (
        destination if destination and _norm(destination) not in _NO_DEST else "new destinations"
    )
    signature_suffix = _signature_suffix(user.user_id)
    style_article = "an" if style_lower[:1] in {"a", "e", "i", "o", "u"} else "a"

    variants = [
        f"{style} trips are the favorite here. Based in {location}, usually exploring {interests_text}. Next plan: {destination_text}. {signature_suffix}",
        f"From {location}, this {style_lower} traveler enjoys {interests_text} and likes clear plans for {destination_text}. {signature_suffix}",
        f"{location} based and always ready for {destination_text}. Into {interests_text} with a {style_lower} travel vibe. {signature_suffix}",
        f"{style} profile from {location}. Most excited about {interests_text}; currently planning {destination_text}. {signature_suffix}",
        f"Trips centered around {interests_text} are always a plus. Traveling from {location} with {style_article} {style_lower} approach, heading toward {destination_text}. {signature_suffix}",
        f"{destination_text} is on the radar. {location} traveler who prefers {style_lower} plans and enjoys {interests_text}. {signature_suffix}",
        f"Plans trips with a {style_lower} style from {location}. Favorite themes: {interests_text}. Next stop: {destination_text}. {signature_suffix}",
        f"{location} traveler, {style_lower} at heart. Enjoys {interests_text} and is lining up a {destination_text} trip. {signature_suffix}",
    ]
    return variants[idx % len(variants)]


def _signature_suffix(user_id: str) -> str:
    idx = _stable_user_index(user_id)
    signature = _bio_signature(user_id)
    suffixes = [
        f"Travel vibe: {signature}.",
        f"Usually brings {signature} energy.",
        f"Known among friends for the {signature} style.",
        f"Trip mood: {signature}.",
        f"People describe this traveler as {signature}.",
        f"Road style: {signature}.",
    ]
    return suffixes[idx % len(suffixes)]


def _display_bio(user: User) -> str:
    _ = user
    return "Travel companion profile."


def _is_internal_test_user(user: User) -> bool:
    """Hide local smoke/QC test accounts from recommendation results."""
    user_id = _norm(user.user_id)
    name = _norm(user.name)
    email = _norm(user.email)

    if user_id.startswith(_TEST_USER_ID_PREFIXES):
        return True
    if name.startswith(_TEST_NAME_PREFIXES):
        return True
    if email.endswith("@example.com") and (
        user_id.startswith(_TEST_USER_ID_PREFIXES)
        or name.startswith(_TEST_NAME_PREFIXES)
    ):
        return True
    return False


def _get_public_review_stats(db: "Session", user_ids: list[str]) -> dict[str, dict[str, float | int]]:
    """Return public review aggregates keyed by reviewee user_id."""
    if not user_ids:
        return {}

    rows = (
        db.query(
            Review.reviewee_id,
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.review_id).label("review_count"),
        )
        .filter(
            Review.reviewee_id.in_(user_ids),
            Review.is_public == True,
        )
        .group_by(Review.reviewee_id)
        .all()
    )

    stats: dict[str, dict[str, float | int]] = {}
    for reviewee_id, avg_rating, review_count in rows:
        count = int(review_count or 0)
        avg = round(float(avg_rating), 1) if avg_rating is not None else 0.0
        stats[reviewee_id] = {
            "avg": avg,
            "count": count,
        }

    return stats


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
    min_score: float = 35.0,
    trip_override: dict | None = None,
) -> list[dict]:
    """Find the best travel companions from the database.

    Args:
        current_user: The authenticated User ORM object.
        db: SQLAlchemy session.
        top_n: Number of top results to return (default 100).
        min_score: Minimum compatibility score to include.
        trip_override: Optional dict with search-time trip parameters
            (destination, start_date, end_date, budget_range, travel_style,
            strict_filters)
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
    review_stats_by_user = _get_public_review_stats(
        db,
        [candidate.user_id for candidate in candidates],
    )

    # Hard date-overlap filter: when the searcher specifies dates,
    # skip candidates whose dates don't overlap at all. This is what
    # makes adding 2 extra travel days actually change the match list.
    has_dates = user_dict.get("start_date") and user_dict.get("end_date")
    strict_filters = bool(user_dict.get("strict_filters"))
    search_style = _canon_style(user_dict.get("travel_style"))
    search_budget_band = _budget_band(user_dict.get("budget_range"))

    results: list[dict] = []

    for candidate in candidates:
        if _is_internal_test_user(candidate):
            continue

        cand_dict = _user_to_dict(candidate)

        if strict_filters:
            candidate_style = _canon_style(cand_dict.get("travel_style"))
            if search_style and candidate_style != search_style:
                continue

            candidate_budget_band = _budget_band(cand_dict.get("budget_range"))
            if search_budget_band and candidate_budget_band != search_budget_band:
                continue

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
            review_stats = review_stats_by_user.get(candidate.user_id)
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
                    "bio": _display_bio(candidate),
                    "review_avg_rating": review_stats["avg"] if review_stats else None,
                    "review_count": int(review_stats["count"]) if review_stats else 0,
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
    try:
        db.commit()
    except IntegrityError:
        # Another request may have created the same pair concurrently.
        db.rollback()
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
        raise

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

    current_user = db.query(User).filter(User.user_id == current_user_id).first()
    current_user_end_date = current_user.end_date if current_user else None

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
    review_stats_by_user = _get_public_review_stats(
        db,
        [other_user.user_id for _, other_user in rows],
    )

    results: list[dict] = []
    for match, other_user in rows:
        review_stats = review_stats_by_user.get(other_user.user_id)
        trip_completed = _is_trip_completed_for_pair(
            current_user_end_date,
            other_user.end_date,
        )
        can_current_user_end_chat = match.status == "accepted" and trip_completed
        end_chat_available_on = _end_chat_available_on(
            current_user_end_date,
            other_user.end_date,
        )
        results.append(
            {
                "match_id": match.match_id,
                "compatibility_score": match.compatibility_score,
                "status": match.status,
                "created_at": match.created_at,
                "requested_by_current_user": match.user1_id == current_user_id,
                "can_current_user_accept": match.status == "pending" and match.user2_id == current_user_id,
                "trip_completed": trip_completed,
                "can_current_user_end_chat": can_current_user_end_chat,
                "end_chat_available_on": end_chat_available_on.isoformat() if end_chat_available_on else None,
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
                    "bio": _display_bio(other_user),
                    "review_avg_rating": review_stats["avg"] if review_stats else None,
                    "review_count": int(review_stats["count"]) if review_stats else 0,
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

    # Only the receiver (user2) can accept an incoming pending request.
    if match.status == "pending" and new_status == "accepted" and current_user_id != match.user2_id:
        raise ValueError("Only the request recipient can accept this match")

    # Enforce valid state transitions
    allowed = ALLOWED_TRANSITIONS.get(match.status, set())
    if new_status not in allowed:
        raise ValueError(
            f"Cannot transition from '{match.status}' to '{new_status}'"
        )

    # End-chat guard: accepted -> cancelled only after both trips are completed.
    if match.status == "accepted" and new_status == "cancelled":
        user_rows = (
            db.query(User.user_id, User.end_date)
            .filter(User.user_id.in_([match.user1_id, match.user2_id]))
            .all()
        )
        end_dates = {uid: end_date for uid, end_date in user_rows}
        if not _is_trip_completed_for_pair(
            end_dates.get(match.user1_id),
            end_dates.get(match.user2_id),
        ):
            raise ValueError(
                "End chat is allowed only after both travelers complete the trip"
            )

    match.status = new_status
    db.commit()
    db.refresh(match)
    return match
