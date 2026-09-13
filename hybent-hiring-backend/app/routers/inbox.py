import uuid

from fastapi import APIRouter, HTTPException

from app.dependencies import DB, CurrentUser
from app.schemas.email_message import EmailMessageDetail, EmailMessageRead
from app.schemas.response import APIResponse
from app.services.email_accounts_service import EmailAccountsService
from app.services.email_inbox_service import EmailInboxService

router = APIRouter(prefix="/v1/inbox", tags=["inbox"])


async def _resolve_inbox_account(db: DB, current_user: CurrentUser):
    accounts_service = EmailAccountsService(db)
    account = await accounts_service.get_inbox_account(
        current_user.organization_id, current_user.id, current_user.role
    )
    return account


@router.get("")
async def list_inbox_messages(db: DB, current_user: CurrentUser, limit: int = 50, offset: int = 0):
    account = await _resolve_inbox_account(db, current_user)
    if account is None:
        return APIResponse.success(
            message="No mailbox configured for your inbox yet.",
            data={"account": None, "messages": []},
        )

    inbox_service = EmailInboxService(db)
    messages = await inbox_service.list_messages(account.id, limit=limit, offset=offset)
    return APIResponse.success(
        message="Inbox retrieved.",
        data={
            "account": {"id": str(account.id), "email_address": account.email_address, "provider": account.provider},
            "messages": [EmailMessageRead.model_validate(m) for m in messages],
        },
    )


@router.post("/sync")
async def sync_inbox(db: DB, current_user: CurrentUser):
    account = await _resolve_inbox_account(db, current_user)
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox configured for your inbox yet.")
    if account.provider != "gmail":
        raise HTTPException(
            status_code=400, detail="Inbox sync is only available for Gmail-connected accounts right now."
        )

    inbox_service = EmailInboxService(db)
    try:
        new_count = await inbox_service.sync_account(account)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not sync inbox: {e}")
    return APIResponse.success(message=f"Synced — {new_count} new message(s).", data={"new_count": new_count})


@router.get("/{message_id}", response_model=EmailMessageDetail)
async def get_inbox_message(message_id: uuid.UUID, db: DB, current_user: CurrentUser):
    account = await _resolve_inbox_account(db, current_user)
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox configured for your inbox yet.")

    inbox_service = EmailInboxService(db)
    try:
        message, body = await inbox_service.get_message_detail(account, message_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    detail = EmailMessageDetail.model_validate(message)
    detail.body_html = body.get("body_html")
    detail.body_text = body.get("body_text")
    return APIResponse.success(message="Message retrieved.", data=detail)
