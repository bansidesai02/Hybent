import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.dependencies import DB, CurrentUser, require_roles
from app.models.user import User
from app.schemas.email_account import (
    EmailAccountCreateSMTP,
    EmailAccountRead,
    EmailAccountTestSendResult,
    EmailAccountUpdate,
)
from app.schemas.response import APIResponse
from app.services.email_accounts_service import EmailAccountsService
from app.services.email_providers import gmail_provider
from app.utils.permissions import UserRole

router = APIRouter(prefix="/v1/email-accounts", tags=["email-accounts"])

# Org admins manage their own mailboxes; super admins get the same access so
# they can help/debug a client org's email setup (they still only ever act
# within their own current_user.organization_id, same as any admin — this is
# not cross-org access, just a role broadened from the plain-admin-only default).
EmailAccountsAdmin = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.SUPER_ADMIN))]

SETTINGS_PATH = {
    UserRole.ADMIN.value: "/hiring/admin/settings",
    UserRole.SUPER_ADMIN.value: "/hiring/super-admin/settings",
}


@router.get("", response_model=list[EmailAccountRead])
async def list_email_accounts(db: DB, current_user: CurrentUser):
    service = EmailAccountsService(db)
    accounts = await service.list_for_org(current_user.organization_id)
    return APIResponse.success(
        message="Email accounts retrieved.",
        data=[EmailAccountRead.model_validate(a) for a in accounts],
    )


@router.post("/smtp", response_model=EmailAccountRead)
async def connect_smtp_account(payload: EmailAccountCreateSMTP, db: DB, current_user: EmailAccountsAdmin):
    service = EmailAccountsService(db)
    try:
        account = await service.connect_smtp(current_user.organization_id, current_user.id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse.success(
        message="SMTP account connected.", data=EmailAccountRead.model_validate(account)
    )


@router.get("/gmail/authorize")
async def gmail_authorize(current_user: EmailAccountsAdmin):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Gmail integration is not configured")
    # Role travels in `state` so the callback can send admins and super admins
    # back to their own settings page — they live at different routes.
    state = f"{current_user.organization_id}:{current_user.id}:{current_user.role}"
    return APIResponse.success(
        message="Gmail auth URL generated.",
        data={"auth_url": gmail_provider.build_authorize_url(state)},
    )


@router.get("/gmail/callback")
async def gmail_callback(
    request: Request,
    db: DB,
    state: str = Query(...),
    code: str | None = Query(None),
    error: str | None = Query(None),
):
    settings_path = SETTINGS_PATH.get(state.split(":")[-1], SETTINGS_PATH[UserRole.ADMIN.value])

    if error or not code:
        return RedirectResponse(url=f"{settings.frontend_url}{settings_path}?error=email_account_auth_failed")

    try:
        organization_id_str, user_id_str, _role = state.split(":", 2)
        organization_id = uuid.UUID(organization_id_str)
        user_id = uuid.UUID(user_id_str)

        tokens = await gmail_provider.exchange_code(code)
        service = EmailAccountsService(db)
        await service.upsert_gmail(
            organization_id,
            user_id,
            tokens["email_address"],
            tokens.get("refresh_token"),
            tokens.get("access_token"),
        )
        return RedirectResponse(url=f"{settings.frontend_url}{settings_path}?success=email_account_connected")
    except Exception:
        return RedirectResponse(url=f"{settings.frontend_url}{settings_path}?error=email_account_auth_failed")


@router.post("/outlook/authorize")
async def outlook_authorize(current_user: EmailAccountsAdmin):
    raise HTTPException(status_code=501, detail="Outlook integration is coming soon")


@router.patch("/{account_id}", response_model=EmailAccountRead)
async def update_email_account(
    account_id: uuid.UUID, payload: EmailAccountUpdate, db: DB, current_user: EmailAccountsAdmin
):
    service = EmailAccountsService(db)
    try:
        account = await service.update(
            account_id, current_user.organization_id, payload.display_name, payload.is_default
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return APIResponse.success(message="Email account updated.", data=EmailAccountRead.model_validate(account))


@router.delete("/{account_id}")
async def disconnect_email_account(account_id: uuid.UUID, db: DB, current_user: EmailAccountsAdmin):
    service = EmailAccountsService(db)
    try:
        await service.disconnect(account_id, current_user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return APIResponse.success(message="Email account disconnected.")


@router.post("/{account_id}/set-default", response_model=EmailAccountRead)
async def set_default_email_account(account_id: uuid.UUID, db: DB, current_user: EmailAccountsAdmin):
    service = EmailAccountsService(db)
    try:
        account = await service.set_default(account_id, current_user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return APIResponse.success(message="Default email account updated.", data=EmailAccountRead.model_validate(account))


@router.post("/{account_id}/test", response_model=EmailAccountTestSendResult)
async def test_send_email_account(account_id: uuid.UUID, db: DB, current_user: EmailAccountsAdmin):
    service = EmailAccountsService(db)
    try:
        await service.test_send(account_id, current_user.organization_id, current_user.email)
    except ValueError as e:
        # Account not found / bad provider — a client-correctable request error.
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Provider send failure (SMTP auth, network, OAuth) — a reportable result,
        # not a 500: the account exists and the request was well-formed.
        return APIResponse.success(
            message="Test send failed.",
            data=EmailAccountTestSendResult(success=False, detail=str(e)).model_dump(),
        )
    return APIResponse.success(
        message="Test email sent.",
        data=EmailAccountTestSendResult(success=True).model_dump(),
    )
