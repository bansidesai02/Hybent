"""SMS settings (admins) and the delivery log."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select

from app.core.config import settings
from app.dependencies import DB, AdminUser, RecruiterUser
from app.models.sms import SmsLog, SmsSettings
from app.schemas.response import APIResponse
from app.services import sms_service

router = APIRouter(prefix="/v1/sms", tags=["sms"])


def _settings_payload(row: SmsSettings | None) -> dict:
    return {
        "enabled": bool(row and row.enabled),
        "live": sms_service.provider_live(),
        "provider": settings.sms_provider,
        "needs_template_ids": sms_service.needs_template_ids(),
        "daily_limit": settings.sms_daily_limit,
        "sender_id": settings.msg91_sender_id,
        "events": [
            {
                "key": e.key, "audience": e.audience, "label": e.label, "text": e.text,
                **sms_service.event_settings(row, e.key),
            }
            for e in sms_service.EVENTS.values()
        ],
    }


@router.get("/settings")
async def get_sms_settings(db: DB, current_user: RecruiterUser):
    row = await sms_service.get_settings(db, current_user.organization_id)
    return APIResponse.success(message="SMS settings.", data=_settings_payload(row))


class EventSetting(BaseModel):
    on: bool
    template_id: str = Field("", max_length=100)


class SmsSettingsUpdate(BaseModel):
    enabled: bool
    events: dict[str, EventSetting] = Field(default_factory=dict)


@router.put("/settings")
async def update_sms_settings(body: SmsSettingsUpdate, db: DB, current_user: AdminUser):
    unknown = set(body.events) - set(sms_service.EVENTS)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown SMS events: {', '.join(sorted(unknown))}")
    row = await sms_service.get_settings(db, current_user.organization_id)
    if row is None:
        row = SmsSettings(organization_id=current_user.organization_id, events={})
        db.add(row)
    row.enabled = body.enabled
    events = dict(row.events or {})
    for key, cfg in body.events.items():
        events[key] = {"on": cfg.on, "template_id": cfg.template_id.strip()}
    row.events = events
    await db.commit()
    await db.refresh(row)
    return APIResponse.success(message="SMS settings saved.", data=_settings_payload(row))


class TestSms(BaseModel):
    event: str
    phone: str = Field(..., min_length=8, max_length=20)


@router.post("/test")
async def send_test_sms(body: TestSms, db: DB, current_user: AdminUser):
    """Send one message with sample values to check a template end to end."""
    event = sms_service.EVENTS.get(body.event)
    if not event:
        raise HTTPException(status_code=422, detail="Unknown SMS event.")
    sample = {
        "name": "Rahul", "job": "Sales Executive", "company": "Hybent", "link": settings.frontend_url,
        "when": "18 Nov, 11:00 AM", "candidate": "Rahul Sharma",
    }
    log = await sms_service.send(db, current_user.organization_id, body.event, body.phone, sample,
                                 recipient_name=current_user.full_name, force=True)
    return APIResponse.success(
        message={"sent": "Test SMS sent.", "test": "Test mode: logged, not sent (no SMS provider connected yet)."}.get(
            log.status, log.error or log.status),
        data={"status": log.status, "error": log.error, "body": log.body},
    )


@router.get("/logs")
async def list_sms_logs(db: DB, current_user: RecruiterUser, limit: int = 50, offset: int = 0):
    rows = (await db.execute(
        select(SmsLog).where(SmsLog.organization_id == current_user.organization_id)
        .order_by(desc(SmsLog.created_at)).limit(min(limit, 200)).offset(offset)
    )).scalars().all()
    return APIResponse.success(message="SMS log.", data=[
        {
            "id": str(r.id), "event": r.event, "audience": r.audience, "recipient_name": r.recipient_name,
            "phone": r.phone, "body": r.body, "status": r.status, "error": r.error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ])
