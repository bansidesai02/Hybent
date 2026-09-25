import uuid
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response

from app.dependencies import DB, CurrentUser
from app.schemas.email_message import EmailAttachment, EmailCandidateLink, EmailMessageDetail, EmailMessageRead
from app.schemas.response import APIResponse
from app.services.email_accounts_service import EmailAccountsService
from app.services.email_inbox_service import EmailInboxService

router = APIRouter(prefix="/v1/inbox", tags=["inbox"])


async def _resolve_inbox_account(db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    """Always one of the caller's own mailboxes — their primary, or the one
    they picked with `account_id`. Never another member's."""
    return await EmailAccountsService(db).get_inbox_account(
        current_user.organization_id, current_user.id, account_id
    )


@router.get("")
async def list_inbox_messages(
    db: DB, current_user: CurrentUser, limit: int = 50, offset: int = 0, account_id: uuid.UUID | None = None
):
    account = await _resolve_inbox_account(db, current_user, account_id)
    # The caller's own readable mailboxes, for switching between them.
    own = await EmailAccountsService(db).list_for_user(current_user.organization_id, current_user.id)
    mailboxes = [
        {"id": str(a.id), "email_address": a.email_address, "is_default": a.is_default}
        for a in own
        if a.provider == "gmail" and a.status == "connected"
    ]
    if account is None:
        return APIResponse.success(
            message="No mailbox configured for your inbox yet.",
            data={"account": None, "messages": [], "mailboxes": mailboxes},
        )

    inbox_service = EmailInboxService(db)
    # The Inbox is the record of applications that arrived by email — only
    # messages ingestion turned into (or matched to) a candidate, not the
    # whole mailbox.
    messages = await inbox_service.list_messages(account.id, limit=limit, offset=offset, resumes_only=True)
    candidates = await inbox_service.candidates_for_messages(messages)

    rows = []
    for m in messages:
        row = EmailMessageRead.model_validate(m)
        row.candidate_count = len(candidates.get(m.id, []))
        rows.append(row)

    return APIResponse.success(
        message="Inbox retrieved.",
        data={
            "account": {"id": str(account.id), "email_address": account.email_address, "provider": account.provider},
            "messages": rows,
            "mailboxes": mailboxes,
        },
    )


@router.post("/sync")
async def sync_inbox(db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    account = await _resolve_inbox_account(db, current_user, account_id)
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
async def get_inbox_message(
    message_id: uuid.UUID, db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None
):
    account = await _resolve_inbox_account(db, current_user, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox configured for your inbox yet.")

    inbox_service = EmailInboxService(db)
    try:
        message, body = await inbox_service.get_message_detail(account, message_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    candidates = (await inbox_service.candidates_for_messages([message])).get(message.id, [])
    # A candidate created from this email keeps the attachment's filename,
    # which is how each attachment finds the candidate it became.
    by_filename = {c.resume_filename: c for c in candidates if c.source_email_message_id == message.id}

    # Per-attachment outcomes recorded by ingestion: "filename<TAB>reason" lines.
    outcomes = {
        line.split("\t", 1)[0]: line.split("\t", 1)[1]
        for line in (message.ingestion_error or "").splitlines()
        if "\t" in line
    }

    detail = EmailMessageDetail.model_validate(message)
    detail.candidate_count = len(candidates)
    detail.body_html = body.get("body_html")
    detail.body_text = body.get("body_text")
    detail.to = body.get("to") or message.to_address
    detail.cc = body.get("cc")
    detail.reply_to = body.get("reply_to")
    detail.date = body.get("date")
    detail.attachments = [
        EmailAttachment(
            index=i,
            filename=a["filename"],
            mime_type=a.get("mime_type") or "application/octet-stream",
            size=a.get("size") or 0,
            candidate_id=str(by_filename[a["filename"]].id) if a["filename"] in by_filename else None,
            candidate_name=by_filename[a["filename"]].full_name if a["filename"] in by_filename else None,
            outcome=None if a["filename"] in by_filename else outcomes.get(a["filename"]),
        )
        for i, a in enumerate(body.get("attachments") or [])
    ]
    detail.candidates = [EmailCandidateLink.model_validate(c) for c in candidates]
    return APIResponse.success(message="Message retrieved.", data=detail)


@router.get("/{message_id}/attachments/{index}")
async def download_inbox_attachment(
    message_id: uuid.UUID, index: int, db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None
):
    """Streams one attachment, fetched live from the provider — attachments are
    never stored at rest, same as bodies."""
    account = await _resolve_inbox_account(db, current_user, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox configured for your inbox yet.")
    try:
        attachment, content = await EmailInboxService(db).get_attachment(account, message_id, index)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=content,
        media_type=attachment.get("mime_type") or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(attachment['filename'])}"},
    )
