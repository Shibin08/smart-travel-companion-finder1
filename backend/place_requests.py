import logging
from datetime import date as _date, datetime as _dt, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from gemini_tags import BUILTIN_DESTINATIONS, generate_tags
from models import Match, Message, PlaceRequest, User
from schemas import (
    JoinPlaceRequestResponse,
    PlaceRequestCreate,
    PlaceRequestListResponse,
    PlaceRequestResponse,
)

router = APIRouter(prefix="/place-requests", tags=["Place Requests"])
logger = logging.getLogger(__name__)


def _parse_applicants(raw: str) -> list[str]:
    if not raw:
        return []
    return [item for item in raw.split(",") if item]


def _to_response(item: PlaceRequest) -> PlaceRequestResponse:
    return PlaceRequestResponse(
        request_id=item.request_id,
        user_id=item.user_id,
        user_name=item.user_name,
        destination=item.destination,
        place_image=item.place_image,
        pin_lat=item.pin_lat,
        pin_lng=item.pin_lng,
        pin_label=item.pin_label,
        start_date=item.start_date,
        end_date=item.end_date,
        companions_needed=item.companions_needed,
        budget=item.budget,
        travel_type=item.travel_type,
        notes=item.notes,
        status=item.status,
        applicants=_parse_applicants(item.applicants),
        created_at=item.created_at,
    )


def _safe_generate_tags(destination: str) -> str:
    """Generate destination tags without breaking request creation."""
    try:
        return generate_tags(destination)
    except Exception:
        logger.warning(
            "Tag generation failed for destination '%s'; continuing without tags",
            destination,
            exc_info=True,
        )
        return ""


@router.get("", response_model=PlaceRequestListResponse)
def list_place_requests(
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(PlaceRequest)
    if status:
        query = query.filter(PlaceRequest.status == status)

    requests = query.order_by(PlaceRequest.created_at.desc()).all()
    return {"total": len(requests), "requests": [_to_response(item) for item in requests]}


@router.get("/destinations")
def list_community_destinations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return unique destinations from posted trip plans with aggregated tags.

    Each destination gets keywords derived from the travel types and budgets
    that users have posted for it. Excludes the built-in destinations that the
    frontend already knows about.
    """
    rows = db.query(
        PlaceRequest.destination,
        PlaceRequest.travel_type,
        PlaceRequest.budget,
        PlaceRequest.place_image,
        PlaceRequest.tags,
    ).all()

    dest_map: dict[str, dict] = {}
    for dest, travel_type, budget, image, tags in rows:
        key = dest.strip().lower()
        if key in BUILTIN_DESTINATIONS or not key:
            continue
        if key not in dest_map:
            # Use stored AI/curated tags if available
            stored = [t.strip() for t in (tags or "").split(",") if t.strip()]
            dest_map[key] = {
                "name": dest.strip(),
                "image": image or "",
                "tags": set(stored) if stored else set(),
            }
        # If no AI tags were stored, fall back to travel_type + budget
        if not dest_map[key]["tags"]:
            dest_map[key]["tags"].add(travel_type)
            dest_map[key]["tags"].add(f"{budget} Budget")

    return [
        {
            "name": v["name"],
            "image": v["image"],
            "properties": sorted(v["tags"]),
        }
        for v in dest_map.values()
    ]


@router.post("", response_model=PlaceRequestResponse, status_code=201)
def create_place_request(
    body: PlaceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    parsed_start = None
    parsed_end = None

    destination = body.destination.strip()
    if not destination:
        raise HTTPException(status_code=400, detail="Destination is required.")

    if body.start_date:
        try:
            parsed_start = _dt.fromisoformat(body.start_date)
            if parsed_start.date() < _date.today():
                raise HTTPException(
                    status_code=400,
                    detail="Start date cannot be in the past. Please select today or a future date."
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start date format.")

    if body.end_date:
        try:
            parsed_end = _dt.fromisoformat(body.end_date)
            if parsed_end.date() < _date.today():
                raise HTTPException(
                    status_code=400,
                    detail="End date cannot be in the past. Please select today or a future date."
                )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end date format.")

    if parsed_start and parsed_end and parsed_end < parsed_start:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )

    item = PlaceRequest(
        user_id=current_user.user_id,
        user_name=current_user.name,
        destination=destination,
        place_image=body.place_image,
        pin_lat=body.pin_lat,
        pin_lng=body.pin_lng,
        pin_label=body.pin_label,
        start_date=body.start_date,
        end_date=body.end_date,
        companions_needed=body.companions_needed,
        budget=body.budget,
        travel_type=body.travel_type,
        notes=body.notes,
        status=body.status,
        tags=_safe_generate_tags(destination),
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return _to_response(item)


@router.post("/{request_id}/join", response_model=JoinPlaceRequestResponse)
def join_place_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Express interest in a trip plan.

    - Adds the current user to the applicants list
    - Creates an auto-accepted match so chat is enabled
    - Sends an introductory message to the poster
    """
    trip = db.query(PlaceRequest).filter(PlaceRequest.request_id == request_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip plan not found")

    # Cannot join your own trip
    if trip.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot join your own trip")

    # Check if trip is expired
    try:
        end = _dt.fromisoformat(trip.end_date)
        if end.date() < _date.today():
            raise HTTPException(status_code=400, detail="This trip has already ended")
    except ValueError:
        pass

    # Check if already joined
    existing_applicants = _parse_applicants(trip.applicants)
    if current_user.user_id in existing_applicants:
        raise HTTPException(status_code=400, detail="You have already joined this trip")

    # Add to applicants
    existing_applicants.append(current_user.user_id)
    trip.applicants = ",".join(existing_applicants)

    # Create or reuse an accepted match so the two users can chat
    existing_match = (
        db.query(Match)
        .filter(
            or_(
                (Match.user1_id == current_user.user_id) & (Match.user2_id == trip.user_id),
                (Match.user1_id == trip.user_id) & (Match.user2_id == current_user.user_id),
            ),
        )
        .first()
    )

    if existing_match:
        if existing_match.status != "accepted":
            existing_match.status = "accepted"
    else:
        new_match = Match(
            user1_id=current_user.user_id,
            user2_id=trip.user_id,
            compatibility_score=0.0,
            status="accepted",
        )
        db.add(new_match)

    # Send an introductory message from the joiner to the poster
    intro_msg = Message(
        sender_id=current_user.user_id,
        receiver_id=trip.user_id,
        message_text=(
            f"Hi! I'm interested in joining your trip to {trip.destination} "
            f"({trip.start_date} to {trip.end_date}). Let's plan together!"
        ),
    )
    db.add(intro_msg)

    db.commit()

    return JoinPlaceRequestResponse(
        message="Successfully joined the trip!",
        poster_user_id=trip.user_id,
        request_id=trip.request_id,
    )
