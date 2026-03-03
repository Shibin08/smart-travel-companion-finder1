from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import EmergencyAlert, User
from schemas import (
    EmergencyAlertCreate,
    EmergencyAlertListResponse,
    EmergencyAlertResponse,
    EmergencyAlertStatusUpdate,
    EmergencyLocation,
)

router = APIRouter(prefix="/emergency", tags=["Emergency"])


def _parse_responders(raw: str) -> list[str]:
    if not raw:
        return []
    return [item for item in raw.split(",") if item]


def _to_response(alert: EmergencyAlert) -> EmergencyAlertResponse:
    return EmergencyAlertResponse(
        alert_id=alert.alert_id,
        user_id=alert.user_id,
        alert_type=alert.alert_type,
        message=alert.message,
        severity=alert.severity,
        status=alert.status,
        location=EmergencyLocation(
            latitude=alert.latitude,
            longitude=alert.longitude,
            address=alert.address,
        ),
        responders=_parse_responders(alert.responders),
        created_at=alert.created_at,
        resolved_at=alert.resolved_at,
    )


@router.get("/alerts/active", response_model=EmergencyAlertListResponse)
def list_active_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alerts = (
        db.query(EmergencyAlert)
        .filter(EmergencyAlert.status.in_(["Active", "Acknowledged"]))
        .order_by(EmergencyAlert.created_at.desc())
        .all()
    )
    return {"total": len(alerts), "alerts": [_to_response(item) for item in alerts]}


@router.get("/alerts/me", response_model=EmergencyAlertListResponse)
def list_my_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alerts = (
        db.query(EmergencyAlert)
        .filter(EmergencyAlert.user_id == current_user.user_id)
        .order_by(EmergencyAlert.created_at.desc())
        .all()
    )
    return {"total": len(alerts), "alerts": [_to_response(item) for item in alerts]}


@router.post("/alerts", response_model=EmergencyAlertResponse, status_code=201)
def create_alert(
    body: EmergencyAlertCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = EmergencyAlert(
        user_id=current_user.user_id,
        alert_type=body.alert_type,
        message=body.message,
        severity=body.severity,
        status="Active",
        latitude=body.location.latitude,
        longitude=body.location.longitude,
        address=body.location.address,
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return _to_response(alert)


@router.patch("/alerts/{alert_id}/status", response_model=EmergencyAlertResponse)
def update_alert_status(
    alert_id: int,
    body: EmergencyAlertStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(EmergencyAlert).filter(EmergencyAlert.alert_id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")

    if alert.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only alert owner can update status")

    alert.status = body.status
    if body.status == "Resolved":
        alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return _to_response(alert)
