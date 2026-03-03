from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import PlaceRequest, User
from schemas import PlaceRequestCreate, PlaceRequestListResponse, PlaceRequestResponse

router = APIRouter(prefix="/place-requests", tags=["Place Requests"])


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


@router.post("", response_model=PlaceRequestResponse, status_code=201)
def create_place_request(
    body: PlaceRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = PlaceRequest(
        user_id=current_user.user_id,
        user_name=current_user.name,
        destination=body.destination,
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
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return _to_response(item)
