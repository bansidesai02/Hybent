import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.base import OrmSchema


class MessageBase(BaseModel):
    content: str


class MessageCreate(MessageBase):
    receiver_id: uuid.UUID


class MessageRead(MessageBase, OrmSchema):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    is_read: bool
    created_at: datetime


class ConversationSummary(BaseModel):
    other_user_id: uuid.UUID
    other_user_full_name: str
    other_user_avatar_url: str | None = None
    last_message: str
    last_message_at: datetime
    unread_count: int
