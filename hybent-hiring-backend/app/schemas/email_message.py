from datetime import datetime

from app.schemas.base import OrmSchema


class EmailMessageRead(OrmSchema):
    id: str
    email_account_id: str
    thread_id: str | None = None
    from_address: str | None = None
    from_name: str | None = None
    to_address: str | None = None
    subject: str | None = None
    snippet: str | None = None
    received_at: datetime | None = None
    is_read: bool
    ingestion_status: str | None = None
    # Candidates this email produced (or was matched to) — filled in by the router.
    candidate_count: int = 0


class EmailAttachment(OrmSchema):
    # Position in the message's attachment list; the download endpoint's key.
    index: int
    filename: str
    mime_type: str
    size: int = 0
    # The candidate created from this attachment, when there is one.
    candidate_id: str | None = None
    candidate_name: str | None = None


class EmailCandidateLink(OrmSchema):
    id: str
    full_name: str
    email: str | None = None
    resume_filename: str | None = None
    pipeline_stage: str | None = None


class EmailMessageDetail(EmailMessageRead):
    body_html: str | None = None
    body_text: str | None = None
    to: str | None = None
    cc: str | None = None
    reply_to: str | None = None
    date: str | None = None
    attachments: list[EmailAttachment] = []
    candidates: list[EmailCandidateLink] = []
