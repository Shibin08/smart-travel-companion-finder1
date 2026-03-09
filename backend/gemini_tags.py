"""
Generate iconic destination keywords using Google Gemini Flash (free tier).

Falls back to the curated DESTINATION_KEYWORDS map when Gemini is unavailable
or the API key is not configured.
"""

import json
import logging
import math
import re
import time

from google import genai

from config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

_GEMINI_DEFAULT_COOLDOWN_SECONDS = 60
_GEMINI_MAX_COOLDOWN_SECONDS = 15 * 60
_gemini_cooldown_until = 0.0

# ── Curated fallback for well-known Indian destinations ──────────────────

DESTINATION_KEYWORDS: dict[str, list[str]] = {
    "varanasi": ["Ghats", "Temples", "Spiritual"],
    "agra": ["Taj Mahal", "Mughal Heritage", "Monuments"],
    "delhi": ["Street Food", "Historical", "Metro City"],
    "mumbai": ["Bollywood", "Gateway of India", "Street Food"],
    "udaipur": ["Lake Palace", "Romantic", "Rajput Heritage"],
    "jodhpur": ["Blue City", "Mehrangarh Fort", "Desert"],
    "shimla": ["Colonial", "Mall Road", "Hill Station"],
    "darjeeling": ["Tea Gardens", "Toy Train", "Himalayan Views"],
    "mysore": ["Mysore Palace", "Silk & Sandalwood", "Heritage"],
    "hampi": ["Ruins", "Bouldering", "UNESCO Heritage"],
    "amritsar": ["Golden Temple", "Wagah Border", "Punjabi Food"],
    "ooty": ["Tea Plantations", "Nilgiri Hills", "Toy Train"],
    "munnar": ["Tea Estates", "Western Ghats", "Misty Hills"],
    "pushkar": ["Camel Fair", "Sacred Lake", "Desert"],
    "mcleodganj": ["Tibetan Culture", "Trekking", "Monastery"],
    "leh": ["Pangong Lake", "Monasteries", "High Altitude"],
    "spiti": ["Remote Valley", "Monasteries", "Stargazing"],
    "kodaikanal": ["Lake", "Hill Station", "Waterfalls"],
    "gangtok": ["Monasteries", "MG Marg", "Himalayan Views"],
    "shillong": ["Waterfalls", "Living Root Bridges", "Music"],
    "kashmir": ["Dal Lake", "Shikara", "Snow"],
    "srinagar": ["Dal Lake", "Houseboats", "Gardens"],
    "nainital": ["Naini Lake", "Hill Station", "Boating"],
    "ranthambore": ["Tiger Safari", "Wildlife", "Fort"],
    "khajuraho": ["UNESCO Temples", "Sculptures", "History"],
    "aurangabad": ["Ajanta & Ellora", "Caves", "Heritage"],
    "vizag": ["Beach", "Submarine Museum", "Araku Valley"],
    "alleppey": ["Backwaters", "Houseboat", "Kerala Cuisine"],
    "meghalaya": ["Living Root Bridges", "Caves", "Wettest Place"],
    "kolkata": ["Victoria Memorial", "Street Food", "Art & Culture"],
    "bangalore": ["IT Hub", "Pubs & Cafes", "Gardens"],
    "hyderabad": ["Biryani", "Charminar", "Old City"],
    "chennai": ["Temples", "Marina Beach", "South Indian Food"],
    "pune": ["Forts", "Cafes", "Pleasant Weather"],
    "jaisalmer": ["Sand Dunes", "Desert Safari", "Golden Fort"],
    "mount abu": ["Hill Station", "Dilwara Temples", "Rajasthan"],
    "lonavala": ["Weekend Getaway", "Waterfalls", "Caves"],
    "mahabaleshwar": ["Strawberries", "Viewpoints", "Hill Station"],
    "diu": ["Beach", "Portuguese Heritage", "Peaceful"],
    "orchha": ["Temples", "Cenotaphs", "Hidden Gem"],
    "bhubaneswar": ["Temples", "Odisha Culture", "Heritage"],
    "puri": ["Jagannath Temple", "Beach", "Pilgrimage"],
    "kutch": ["White Desert", "Rann Utsav", "Handicrafts"],
}

# ── Built-in destinations (frontend already has keywords for these) ──────

BUILTIN_DESTINATIONS = {
    "goa", "manali", "kerala", "rishikesh", "jaipur",
    "ladakh", "coorg", "andaman", "pondicherry",
}


def _cooldown_remaining_seconds() -> int:
    remaining = int(math.ceil(_gemini_cooldown_until - time.monotonic()))
    return max(0, remaining)


def _extract_retry_seconds(message: str) -> int | None:
    """Extract retry delay from Gemini error text if present."""
    match = re.search(r"Please retry in ([0-9]+(?:\.[0-9]+)?)s", message, flags=re.IGNORECASE)
    if not match:
        return None
    return max(1, int(math.ceil(float(match.group(1)))))


def _is_quota_or_rate_limit_error(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    status = str(getattr(exc, "status", "")).upper()
    message = str(getattr(exc, "message", exc)).lower()

    if code == 429 or status == "RESOURCE_EXHAUSTED":
        return True
    return any(token in message for token in ("quota exceeded", "rate limit", "too many requests"))


def _set_gemini_cooldown(seconds: int, reason: str) -> None:
    global _gemini_cooldown_until
    safe_seconds = max(10, min(seconds, _GEMINI_MAX_COOLDOWN_SECONDS))
    _gemini_cooldown_until = time.monotonic() + safe_seconds
    logger.warning("Gemini cooldown enabled for %ss (%s)", safe_seconds, reason)


def _generate_via_gemini(destination: str) -> list[str] | None:
    """Call Gemini Flash to generate 3 iconic travel keywords."""
    if not GEMINI_API_KEY:
        return None
    remaining = _cooldown_remaining_seconds()
    if remaining > 0:
        logger.info(
            "Skipping Gemini for '%s' (cooldown active: %ss remaining)",
            destination,
            remaining,
        )
        return None

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f'Return exactly 3 iconic travel keywords for the destination "{destination}" '
                f"as a JSON array of strings. Only the JSON array, nothing else. "
                f'Example: ["Ghats", "Temples", "Spiritual"]'
            ),
            config={
                "temperature": 0.2,
                "max_output_tokens": 256,
                # Avoid consuming output budget on hidden thinking and
                # reduce chances of truncated JSON output.
                "thinking_config": {"thinking_budget": 0},
            },
        )

        text = resp.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        tags = json.loads(text)
        if isinstance(tags, list) and len(tags) >= 2:
            return [str(t).strip() for t in tags[:3]]
    except Exception as exc:
        if _is_quota_or_rate_limit_error(exc):
            retry_seconds = _extract_retry_seconds(str(getattr(exc, "message", exc)))
            _set_gemini_cooldown(
                (retry_seconds or _GEMINI_DEFAULT_COOLDOWN_SECONDS) + 2,
                "quota or rate limit",
            )
            logger.warning(
                "Gemini quota/rate limit for '%s'; using fallback tags",
                destination,
            )
            return None
        logger.warning("Gemini tag generation failed for '%s'", destination, exc_info=True)

    return None


def generate_tags(destination: str) -> str:
    """Return a comma-separated string of 3 iconic tags for a destination.

    Priority:
      1. Curated DESTINATION_KEYWORDS map
      2. Gemini Flash API (if key configured)
      3. Empty string (frontend falls back to travel_type + budget)
    """
    key = destination.strip().lower()

    # 1) Check curated map
    curated = DESTINATION_KEYWORDS.get(key)
    if curated:
        return ",".join(curated)

    # 2) Try Gemini
    ai_tags = _generate_via_gemini(destination.strip())
    if ai_tags:
        # Cache into the curated map so future lookups are instant
        DESTINATION_KEYWORDS[key] = ai_tags
        return ",".join(ai_tags)

    # 3) Nothing available
    return ""
