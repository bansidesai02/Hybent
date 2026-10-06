import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from app.schemas.base import OrmSchema


class AttachmentRead(OrmSchema):
    id: uuid.UUID
    file_name: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class MessageBase(BaseModel):
    content: str = ""


class MessageCreate(MessageBase):
    receiver_id: uuid.UUID
    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _not_empty(self):
        if not self.content.strip() and not self.attachment_ids:
            raise ValueError("A message needs text or at least one attachment.")
        return self


class GroupMessageCreate(MessageBase):
    attachment_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _not_empty(self):
        if not self.content.strip() and not self.attachment_ids:
            raise ValueError("A message needs text or at least one attachment.")
        return self


class MessageRead(MessageBase, OrmSchema):
    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    is_read: bool
    created_at: datetime
    attachments: list[AttachmentRead] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    other_user_id: uuid.UUID
    other_user_full_name: str
    other_user_avatar_url: str | None = None
    last_message: str
    last_message_at: datetime
    unread_count: int


# ── Groups ──────────────────────────────────────────────────────────────────

class ChatGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    member_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class ChatGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_archived: bool | None = None


class ChatGroupMembersAdd(BaseModel):
    user_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class ChatGroupMemberRoleUpdate(BaseModel):
    role: Literal["admin", "member"]


class ChatGroupMemberRead(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    avatar_url: str | None = None
    user_role: str
    role: str
    joined_at: datetime


class ChatGroupRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    created_by: uuid.UUID | None = None
    is_archived: bool
    created_at: datetime
    member_count: int
    my_role: str
    can_add_members: bool
    can_manage: bool
    last_message: str | None = None
    last_message_at: datetime | None = None
    last_message_sender_name: str | None = None
    unread_count: int = 0


class ChatGroupDetail(ChatGroupRead):
    members: list[ChatGroupMemberRead]


class GroupMessageRead(MessageRead):
    sender_name: str | None = None
    sender_avatar: str | None = None
