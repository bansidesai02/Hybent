from datetime import datetime

from app.schemas.base import OrmSchema


class EmailMessageRead(OrmSchema):
    id: str
    email_account_id: str
    thread_id: str | None = None
    from_address: str | None = None
    from_name: str | None = None
    subject: str | None = None
    snippet: str | None = None
    received_at: datetime | None = None
    is_read: bool


class EmailMessageDetail(EmailMessageRead):
    body_html: str | None = None
    body_text: str | None = None
