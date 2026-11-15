import html
import uuid
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select, update

from app.dependencies import DB, CurrentUser
from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope, EmailAccountStatus
from app.models.email_message import EmailMessage
from app.repositories.email_message import INBOX_VIEWS, EmailMessageRepository
from app.schemas.email_message import EmailAttachment, EmailCandidateLink, EmailMessageDetail, EmailMessageRead
from app.schemas.response import APIResponse
from app.services.email_inbox_service import EmailInboxService
from app.services.email_providers import gmail_provider

router = APIRouter(prefix="/v1/inbox", tags=["inbox"])

# Roles that see the company mailboxes an admin connected (scope "organization").
# A recruiter's own personal mailbox stays private to them.
SHARED_INBOX_ROLES = {"admin", "recruiter", "super_admin"}


async def _readable_mailboxes(db: DB, current_user: CurrentUser) -> list[EmailAccount]:
    """Mailboxes this user may open: their own, plus the company ones."""
    conditions = [EmailAccount.connected_by_user_id == current_user.id]
    if current_user.role in SHARED_INBOX_ROLES:
        conditions.append(EmailAccount.scope == EmailAccountScope.ORGANIZATION)
    result = await db.execute(
        select(EmailAccount)
        .where(
            EmailAccount.organization_id == current_user.organization_id,
            EmailAccount.status != EmailAccountStatus.DISCONNECTED,
            or_(*conditions),
        )
        .order_by(EmailAccount.created_at.asc())
    )
    return list(result.scalars().all())


async def _resolve_inbox_account(db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    """The mailbox being looked at: the one picked with `account_id`, else the
    user's own primary, else the company's. A mailbox needing reconnection is
    still returned (so the page can say so) when nothing else is readable."""
    boxes = await _readable_mailboxes(db, current_user)
    if account_id is not None:
        return next((b for b in boxes if b.id == account_id), None)
    connected = [b for b in boxes if b.status == EmailAccountStatus.CONNECTED]
    gmail = [b for b in connected if b.provider == EmailAccountProvider.GMAIL]
    mine = lambda group: [b for b in group if b.connected_by_user_id == current_user.id]
    # Own Gmail, then the company's Gmail, then any own / company mailbox.
    for group in (mine(gmail), gmail, mine(connected), connected):
        if group:
            return next((b for b in group if b.is_default), group[0])
    return boxes[0] if boxes else None


def _require_connected(account: EmailAccount | None) -> EmailAccount:
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox connected for your inbox yet.")
    if account.status != EmailAccountStatus.CONNECTED:
        raise HTTPException(status_code=409, detail="This Gmail needs to be reconnected in Settings → Email accounts.")
    return account


@router.get("")
async def list_inbox_messages(
    db: DB, current_user: CurrentUser, limit: int = 50, offset: int = 0,
    account_id: uuid.UUID | None = None, view: str = "all",
):
    if view not in INBOX_VIEWS:
        raise HTTPException(status_code=422, detail="Unknown view.")
    boxes = await _readable_mailboxes(db, current_user)
    account = await _resolve_inbox_account(db, current_user, account_id)
    mailboxes = [
        {"id": str(a.id), "email_address": a.email_address, "is_default": a.is_default,
         "shared": a.connected_by_user_id != current_user.id, "status": a.status}
        for a in boxes
        if a.provider == EmailAccountProvider.GMAIL
    ]
    if account is None:
        return APIResponse.success(
            message="No mailbox configured for your inbox yet.",
            data={"account": None, "messages": [], "mailboxes": mailboxes, "counts": {}},
        )

    inbox_service = EmailInboxService(db)
    repo = EmailMessageRepository(db)
    messages = await repo.list_for_account(account.id, limit=limit, offset=offset, view=view, since=account.created_at)
    candidates = await inbox_service.candidates_for_messages(messages)

    rows = []
    for m in messages:
        row = EmailMessageRead.model_validate(m)
        row.candidate_count = len(candidates.get(m.id, []))
        rows.append(row)

    return APIResponse.success(
        message="Inbox retrieved.",
        data={
            "account": {
                "id": str(account.id), "email_address": account.email_address, "provider": account.provider,
                "status": account.status, "shared": account.connected_by_user_id != current_user.id,
                "last_synced_at": account.last_synced_at.isoformat() if account.last_synced_at else None,
                "history_done": account.resume_backfill_done,
            },
            "messages": rows,
            "mailboxes": mailboxes,
            "counts": await repo.view_counts(account.id, since=account.created_at),
        },
    )


@router.post("/sync")
async def sync_inbox(db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    account = _require_connected(await _resolve_inbox_account(db, current_user, account_id))
    if account.provider != EmailAccountProvider.GMAIL:
        raise HTTPException(
            status_code=400, detail="Inbox sync is only available for Gmail-connected accounts right now."
        )
    try:
        # A manual sync also brings in older resumes faster: 5 pages of history.
        new_count = await EmailInboxService(db).sync_account(account, history_pages=5)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not sync inbox: {e}")
    return APIResponse.success(
        message=f"Synced — {new_count} new resume email(s).",
        data={"new_count": new_count, "history_done": account.resume_backfill_done},
    )


class SendEmail(BaseModel):
    to: list[EmailStr] = Field(..., min_length=1, max_length=20)
    cc: list[EmailStr] = Field(default_factory=list, max_length=20)
    subject: str = Field(..., min_length=1, max_length=300)
    body: str = Field(..., min_length=1, max_length=20000)
    # Set when replying, so the reply joins the same Gmail conversation.
    reply_to_message_id: uuid.UUID | None = None


@router.post("/send")
async def send_email(body: SendEmail, db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    """Send (or reply) from the mailbox being looked at, through Gmail. The
    message also appears in that Gmail's Sent folder."""
    account = _require_connected(await _resolve_inbox_account(db, current_user, account_id))
    if account.provider != EmailAccountProvider.GMAIL:
        raise HTTPException(status_code=400, detail="Sending from the Inbox needs a Gmail-connected mailbox.")
    thread_id = in_reply_to = references = None
    if body.reply_to_message_id:
        original = await EmailMessageRepository(db).get_by_id_and_account(body.reply_to_message_id, account.id)
        if original is None:
            raise HTTPException(status_code=404, detail="Message not found")
        meta = gmail_provider.get_message_metadata(account, original.provider_message_id) or {}
        thread_id = original.thread_id
        in_reply_to = meta.get("message_id_header")
        references = meta.get("references")
    paragraphs = html.escape(body.body.strip()).replace("\r\n", "\n").replace("\n", "<br>")
    html_body = f'<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">{paragraphs}</div>'
    try:
        gmail_provider.send_message(
            account, [str(t) for t in body.to], body.subject.strip(), html_body,
            cc=[str(c) for c in body.cc], thread_id=thread_id, in_reply_to=in_reply_to, references=references,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not send: {e}")
    return APIResponse.success(message=f"Sent from {account.email_address}.")


@router.post("/{message_id}/retry")
async def retry_message(message_id: uuid.UUID, db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None):
    """Process an email's resumes again on the next run (every few minutes)."""
    account = await _resolve_inbox_account(db, current_user, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="No mailbox connected for your inbox yet.")
    message = await EmailMessageRepository(db).get_by_id_and_account(message_id, account.id)
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    await db.execute(update(EmailMessage).where(EmailMessage.id == message.id).values(
        ingestion_status=None, ingestion_attempts=0, ingestion_error=None, ingestion_locked_at=None,
    ))
    await db.commit()
    return APIResponse.success(message="Queued — it will be processed again in a few minutes.")


@router.get("/{message_id}", response_model=EmailMessageDetail)
async def get_inbox_message(
    message_id: uuid.UUID, db: DB, current_user: CurrentUser, account_id: uuid.UUID | None = None
):
    account = _require_connected(await _resolve_inbox_account(db, current_user, account_id))

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
    account = _require_connected(await _resolve_inbox_account(db, current_user, account_id))
    try:
        attachment, content = await EmailInboxService(db).get_attachment(account, message_id, index)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return Response(
        content=content,
        media_type=attachment.get("mime_type") or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(attachment['filename'])}"},
    )
