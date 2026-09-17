import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.dependencies import DB, CurrentUser, require_roles
from app.models.email_account import EmailAccountScope
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/email-accounts", tags=["email-accounts"])

# Admins/super admins connect org-shared mailboxes; recruiters connect their
# own single personal mailbox. All three may therefore hit the connect
# endpoints — what differs is the `scope` assigned to the resulting account
# and what they're allowed to do to an *existing* account (see can_manage()).
EmailAccountsConnector = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.RECRUITER))]

SETTINGS_PATH = {
    UserRole.ADMIN.value: "/hiring/admin/settings",
    UserRole.SUPER_ADMIN.value: "/hiring/super-admin/settings",
    UserRole.RECRUITER.value: "/hiring/recruiter/settings",
}


def _scope_for_role(role: str) -> str:
    return EmailAccountScope.PERSONAL if role == UserRole.RECRUITER.value else EmailAccountScope.ORGANIZATION


@router.get("", response_model=list[EmailAccountRead])
async def list_email_accounts(db: DB, current_user: CurrentUser):
    service = EmailAccountsService(db)
    accounts = await service.list_for_org(current_user.organization_id, current_user.id, current_user.role)
    return APIResponse.success(
        message="Email accounts retrieved.",
        data=[EmailAccountRead.model_validate(a) for a in accounts],
    )


@router.post("/smtp", response_model=EmailAccountRead)
async def connect_smtp_account(payload: EmailAccountCreateSMTP, db: DB, current_user: EmailAccountsConnector):
    service = EmailAccountsService(db)
    try:
        account = await service.connect_smtp(
            current_user.organization_id, current_user.id, payload, scope=_scope_for_role(current_user.role)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse.success(
        message="SMTP account connected.", data=EmailAccountRead.model_validate(account)
    )


@router.get("/gmail/authorize")
async def gmail_authorize(current_user: EmailAccountsConnector):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=400, detail="Gmail integration is not configured")
    # Role travels in `state` so the callback knows both which settings page to
    # redirect back to, and which scope (org vs personal) to assign the account.
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
    role = state.split(":")[-1]
    settings_path = SETTINGS_PATH.get(role, SETTINGS_PATH[UserRole.ADMIN.value])

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
            scope=_scope_for_role(role),
        )
        return RedirectResponse(url=f"{settings.frontend_url}{settings_path}?success=email_account_connected")
    except Exception:
        logger.exception("Gmail OAuth callback failed for state=%r", state)
        return RedirectResponse(url=f"{settings.frontend_url}{settings_path}?error=email_account_auth_failed")


@router.post("/outlook/authorize")
async def outlook_authorize(current_user: EmailAccountsConnector):
    raise HTTPException(status_code=501, detail="Outlook integration is coming soon")


async def _get_manageable_account(service: EmailAccountsService, account_id: uuid.UUID, current_user: User):
    account = await service.get_for_org(account_id, current_user.organization_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Email account not found")
    if not service.can_manage(account, current_user.id, current_user.role):
        raise HTTPException(status_code=403, detail="You don't have permission to manage this account")
    return account


@router.patch("/{account_id}", response_model=EmailAccountRead)
async def update_email_account(
    account_id: uuid.UUID, payload: EmailAccountUpdate, db: DB, current_user: CurrentUser
):
    service = EmailAccountsService(db)
    await _get_manageable_account(service, account_id, current_user)
    try:
        account = await service.update(
            account_id, current_user.organization_id, payload.display_name, payload.is_default
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse.success(message="Email account updated.", data=EmailAccountRead.model_validate(account))


@router.delete("/{account_id}")
async def disconnect_email_account(account_id: uuid.UUID, db: DB, current_user: CurrentUser):
    service = EmailAccountsService(db)
    await _get_manageable_account(service, account_id, current_user)
    await service.disconnect(account_id, current_user.organization_id)
    return APIResponse.success(message="Email account disconnected.")


@router.post("/{account_id}/set-default", response_model=EmailAccountRead)
async def set_default_email_account(account_id: uuid.UUID, db: DB, current_user: CurrentUser):
    service = EmailAccountsService(db)
    await _get_manageable_account(service, account_id, current_user)
    try:
        account = await service.set_default(account_id, current_user.organization_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return APIResponse.success(message="Default email account updated.", data=EmailAccountRead.model_validate(account))


@router.post("/{account_id}/test", response_model=EmailAccountTestSendResult)
async def test_send_email_account(account_id: uuid.UUID, db: DB, current_user: CurrentUser):
    service = EmailAccountsService(db)
    await _get_manageable_account(service, account_id, current_user)
    try:
        await service.test_send(account_id, current_user.organization_id, current_user.email)
    except ValueError as e:
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
