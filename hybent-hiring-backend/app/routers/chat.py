"""
Chat groups and chat file attachments.

Direct messages live in routers/messages.py; this router adds:
- File uploads for chat (10 MB per file, private storage, signed URLs on demand)
- Collaborative groups: create, list, view members, add/remove members,
  group messages and read state.

Permission rules (all scoped to the caller's organization):
- Create a group: admins and recruiters.
- Add members: any admin/recruiter who is in the group, group owners/admins,
  and org admins.
- Remove members, rename, archive, change roles: group owner/admin or org
  admin. Anyone may remove themselves (leave).
- View members and messages: group members only. Org admins may view group
  details (not messages) for moderation.
"""
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import selectinload

from app.dependencies import DB, CurrentUser, RecruiterUser
from app.models.chat_group import ChatGroup, ChatGroupMember, ChatGroupRole
from app.models.message import Message, MessageAttachment
from app.models.user import User
from app.schemas.message import (
    AttachmentRead,
    ChatGroupCreate,
    ChatGroupDetail,
    ChatGroupMemberRead,
    ChatGroupMemberRoleUpdate,
    ChatGroupMembersAdd,
    ChatGroupRead,
    ChatGroupUpdate,
    GroupMessageCreate,
    GroupMessageRead,
)
from app.schemas.response import APIResponse
from app.services import chat_attachment_storage as storage
from app.utils.permissions import UserRole
from app.websocket.manager import ws_manager

router = APIRouter(prefix="/v1/chat", tags=["chat"])

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # strict 10 MB per file
MAX_ATTACHMENTS_PER_MESSAGE = 5
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".ppt", ".pptx",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".zip",
}
ORG_ADMIN_ROLES = {UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value}
RECRUITER_ROLES = {UserRole.ADMIN.value, UserRole.RECRUITER.value, UserRole.SUPER_ADMIN.value}


def _role(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _is_org_admin(user: User) -> bool:
    return _role(user) in ORG_ADMIN_ROLES


# ─────────────────────────────────────────────────────────────────────────────
# Attachments
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/attachments", response_model=AttachmentRead, status_code=201)
async def upload_attachment(db: DB, current_user: CurrentUser, file: UploadFile = File(...)):
    """Upload one file (max 10 MB). Returns an id to pass as attachment_ids when sending."""
    filename = file.filename or "file"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"File type {ext or '(none)'} is not allowed.")

    # Read in chunks and stop as soon as we pass the limit — never trust Content-Length.
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(1024 * 1024):
        total += len(chunk)
        if total > MAX_ATTACHMENT_BYTES:
            raise HTTPException(status_code=413, detail=f"{filename} is larger than 10 MB.")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail="File is empty.")

    content_type = file.content_type or "application/octet-stream"
    path = storage.build_chat_attachment_path(str(current_user.organization_id), filename)
    await storage.upload_chat_attachment(b"".join(chunks), path, content_type)

    attachment = MessageAttachment(
        organization_id=current_user.organization_id,
        uploader_id=current_user.id,
        storage_path=path,
        file_name=filename[:255],
        mime_type=content_type[:150],
        size_bytes=total,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return APIResponse.success(message="File uploaded.", data=AttachmentRead.model_validate(attachment))


@router.get("/attachments/{attachment_id}/url")
async def get_attachment_url(attachment_id: uuid.UUID, db: DB, current_user: CurrentUser, download: bool = False):
    """Short-lived signed URL, only for people who can see the message."""
    att = (await db.execute(
        select(MessageAttachment).where(
            MessageAttachment.id == attachment_id,
            MessageAttachment.organization_id == current_user.organization_id,
        )
    )).scalar_one_or_none()
    if not att:
        raise HTTPException(status_code=404, detail="File not found.")

    allowed = att.uploader_id == current_user.id
    if not allowed and att.message_id:
        msg = await db.get(Message, att.message_id)
        if msg and msg.group_id:
            allowed = await _membership(db, msg.group_id, current_user.id) is not None
        elif msg:
            allowed = current_user.id in (msg.sender_id, msg.receiver_id)
    if not allowed:
        raise HTTPException(status_code=403, detail="You don't have access to this file.")

    url = await storage.get_signed_chat_attachment_url(
        att.storage_path, download_name=att.file_name if download else None
    )
    return APIResponse.success(message="Signed URL generated.", data={"url": url, "expires_in": 300})


async def link_attachments(db, attachment_ids: list[uuid.UUID], user: User, message: Message) -> None:
    """Attach pending uploads owned by `user` to `message`. Caller commits."""
    if not attachment_ids:
        return
    if len(attachment_ids) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise HTTPException(status_code=400, detail=f"At most {MAX_ATTACHMENTS_PER_MESSAGE} files per message.")
    rows = (await db.execute(
        select(MessageAttachment).where(
            MessageAttachment.id.in_(attachment_ids),
            MessageAttachment.uploader_id == user.id,
            MessageAttachment.message_id.is_(None),
        )
    )).scalars().all()
    if len(rows) != len(set(attachment_ids)):
        raise HTTPException(status_code=400, detail="One or more attachments are invalid or already sent.")
    for row in rows:
        row.message_id = message.id


async def load_message(db, message_id: uuid.UUID) -> Message:
    return (await db.execute(
        select(Message).options(selectinload(Message.attachments)).where(Message.id == message_id)
    )).scalar_one()


def attachments_payload(message: Message) -> list[dict]:
    return [AttachmentRead.model_validate(a).model_dump(mode="json") for a in message.attachments]


def message_preview(message: Message) -> str:
    if message.content:
        return message.content
    n = len(message.attachments)
    if n == 1:
        return f"📎 {message.attachments[0].file_name}"
    return f"📎 {n} files" if n else ""


async def cleanup_stale_attachments(db) -> int:
    """Delete uploads never attached to a message after 24h. Safe to call from a periodic task."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = (await db.execute(
        select(MessageAttachment).where(
            MessageAttachment.message_id.is_(None), MessageAttachment.created_at < cutoff
        )
    )).scalars().all()
    await storage.delete_chat_attachments([r.storage_path for r in rows])
    for r in rows:
        await db.delete(r)
    await db.commit()
    return len(rows)


# ─────────────────────────────────────────────────────────────────────────────
# Group helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _membership(db, group_id: uuid.UUID, user_id: uuid.UUID) -> ChatGroupMember | None:
    return (await db.execute(
        select(ChatGroupMember).where(
            ChatGroupMember.group_id == group_id, ChatGroupMember.user_id == user_id
        )
    )).scalar_one_or_none()


async def _get_group(db, group_id: uuid.UUID, user: User) -> ChatGroup:
    group = (await db.execute(
        select(ChatGroup).where(
            ChatGroup.id == group_id, ChatGroup.organization_id == user.organization_id
        )
    )).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")
    return group


def _can_manage(user: User, membership: ChatGroupMember | None) -> bool:
    if _is_org_admin(user):
        return True
    return membership is not None and membership.role in (ChatGroupRole.OWNER, ChatGroupRole.ADMIN)


def _can_add_members(user: User, membership: ChatGroupMember | None) -> bool:
    if _can_manage(user, membership):
        return True
    return membership is not None and _role(user) in RECRUITER_ROLES


async def _member_ids(db, group_id: uuid.UUID) -> list[str]:
    rows = (await db.execute(
        select(ChatGroupMember.user_id).where(ChatGroupMember.group_id == group_id)
    )).scalars().all()
    return [str(r) for r in rows]


async def _group_read(db, group: ChatGroup, user: User, membership: ChatGroupMember | None) -> ChatGroupRead:
    member_count = (await db.execute(
        select(func.count()).select_from(ChatGroupMember).where(ChatGroupMember.group_id == group.id)
    )).scalar() or 0

    last = (await db.execute(
        select(Message, User.full_name)
        .options(selectinload(Message.attachments))
        .join(User, User.id == Message.sender_id)
        .where(Message.group_id == group.id)
        .order_by(desc(Message.created_at))
        .limit(1)
    )).first()

    unread = 0
    if membership:
        unread = (await db.execute(
            select(func.count(Message.id)).where(
                Message.group_id == group.id,
                Message.sender_id != user.id,
                Message.created_at > membership.last_read_at,
            )
        )).scalar() or 0

    return ChatGroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        created_by=group.created_by,
        is_archived=group.is_archived,
        created_at=group.created_at,
        member_count=member_count,
        my_role=membership.role if membership else "none",
        can_add_members=_can_add_members(user, membership),
        can_manage=_can_manage(user, membership),
        last_message=message_preview(last[0]) if last else None,
        last_message_at=last[0].created_at if last else None,
        last_message_sender_name=last[1] if last else None,
        unread_count=unread,
    )


async def _group_detail(db, group: ChatGroup, user: User, membership: ChatGroupMember | None) -> ChatGroupDetail:
    base = await _group_read(db, group, user, membership)
    rows = (await db.execute(
        select(ChatGroupMember, User)
        .join(User, User.id == ChatGroupMember.user_id)
        .where(ChatGroupMember.group_id == group.id)
        .order_by(ChatGroupMember.joined_at)
    )).all()
    role_rank = {ChatGroupRole.OWNER: 0, ChatGroupRole.ADMIN: 1, ChatGroupRole.MEMBER: 2}
    members = sorted(
        (
            ChatGroupMemberRead(
                user_id=u.id, full_name=u.full_name, email=u.email, avatar_url=u.avatar_url,
                user_role=_role(u), role=m.role, joined_at=m.joined_at,
            )
            for m, u in rows
        ),
        key=lambda m: (role_rank.get(m.role, 3), m.full_name.lower()),
    )
    return ChatGroupDetail(**base.model_dump(), members=members)


async def _validate_org_users(db, user_ids: list[uuid.UUID], org_id: uuid.UUID) -> list[User]:
    users = (await db.execute(
        select(User).where(User.id.in_(user_ids), User.organization_id == org_id, User.is_active == True)  # noqa: E712
    )).scalars().all()
    if len(users) != len(set(user_ids)):
        raise HTTPException(status_code=403, detail="You can only add active members of your organization.")
    return list(users)


async def _broadcast_group_updated(db, group: ChatGroup, extra_user_ids: list[str] | None = None) -> None:
    ids = set(await _member_ids(db, group.id)) | set(extra_user_ids or [])
    await ws_manager.broadcast_to_users(list(ids), "group_updated", {"group_id": str(group.id)})


# ─────────────────────────────────────────────────────────────────────────────
# Groups
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/groups", response_model=ChatGroupDetail, status_code=201)
async def create_group(payload: ChatGroupCreate, db: DB, current_user: RecruiterUser):
    member_ids = {uid for uid in payload.member_ids if uid != current_user.id}
    if not member_ids:
        raise HTTPException(status_code=400, detail="Add at least one other member.")
    await _validate_org_users(db, list(member_ids), current_user.organization_id)

    group = ChatGroup(
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        created_by=current_user.id,
    )
    db.add(group)
    await db.flush()
    db.add(ChatGroupMember(group_id=group.id, user_id=current_user.id,
                           role=ChatGroupRole.OWNER, added_by=current_user.id))
    for uid in member_ids:
        db.add(ChatGroupMember(group_id=group.id, user_id=uid,
                               role=ChatGroupRole.MEMBER, added_by=current_user.id))
    await db.commit()
    await db.refresh(group)

    membership = await _membership(db, group.id, current_user.id)
    await _broadcast_group_updated(db, group)
    return APIResponse.success(message="Group created.", data=await _group_detail(db, group, current_user, membership))


@router.get("/groups", response_model=list[ChatGroupRead])
async def list_groups(db: DB, current_user: CurrentUser, include_archived: bool = False):
    """Groups the caller belongs to, most recent activity first."""
    stmt = (
        select(ChatGroup, ChatGroupMember)
        .join(ChatGroupMember, and_(ChatGroupMember.group_id == ChatGroup.id,
                                    ChatGroupMember.user_id == current_user.id))
        .where(ChatGroup.organization_id == current_user.organization_id)
    )
    if not include_archived:
        stmt = stmt.where(ChatGroup.is_archived == False)  # noqa: E712
    rows = (await db.execute(stmt)).all()
    out = [await _group_read(db, g, current_user, m) for g, m in rows]
    out.sort(key=lambda g: g.last_message_at or g.created_at, reverse=True)
    return APIResponse.success(message="Groups retrieved.", data=out)


@router.get("/groups/{group_id}", response_model=ChatGroupDetail)
async def get_group(group_id: uuid.UUID, db: DB, current_user: CurrentUser):
    group = await _get_group(db, group_id, current_user)
    membership = await _membership(db, group.id, current_user.id)
    if not membership and not _is_org_admin(current_user):
        raise HTTPException(status_code=403, detail="You are not a member of this group.")
    return APIResponse.success(message="Group retrieved.", data=await _group_detail(db, group, current_user, membership))


@router.patch("/groups/{group_id}", response_model=ChatGroupDetail)
async def update_group(group_id: uuid.UUID, payload: ChatGroupUpdate, db: DB, current_user: CurrentUser):
    group = await _get_group(db, group_id, current_user)
    membership = await _membership(db, group.id, current_user.id)
    if not _can_manage(current_user, membership):
        raise HTTPException(status_code=403, detail="Only group owners and admins can edit this group.")
    if payload.name is not None:
        group.name = payload.name.strip()
    if payload.description is not None:
        group.description = payload.description.strip() or None
    if payload.is_archived is not None:
        group.is_archived = payload.is_archived
    await db.commit()
    await db.refresh(group)
    await _broadcast_group_updated(db, group)
    return APIResponse.success(message="Group updated.", data=await _group_detail(db, group, current_user, membership))


@router.post("/groups/{group_id}/members", response_model=ChatGroupDetail)
async def add_members(group_id: uuid.UUID, payload: ChatGroupMembersAdd, db: DB, current_user: CurrentUser):
    group = await _get_group(db, group_id, current_user)
    membership = await _membership(db, group.id, current_user.id)
    if not _can_add_members(current_user, membership):
        raise HTTPException(status_code=403, detail="You can't add members to this group.")
    if group.is_archived:
        raise HTTPException(status_code=400, detail="This group is archived.")

    existing = set(await _member_ids(db, group.id))
    new_ids = [uid for uid in set(payload.user_ids) if str(uid) not in existing]
    if new_ids:
        await _validate_org_users(db, new_ids, current_user.organization_id)
        for uid in new_ids:
            db.add(ChatGroupMember(group_id=group.id, user_id=uid,
                                   role=ChatGroupRole.MEMBER, added_by=current_user.id))
        await db.commit()
        await _broadcast_group_updated(db, group)
    return APIResponse.success(
        message=f"{len(new_ids)} member(s) added.",
        data=await _group_detail(db, group, current_user, membership),
    )


@router.delete("/groups/{group_id}/members/{user_id}")
async def remove_member(group_id: uuid.UUID, user_id: uuid.UUID, db: DB, current_user: CurrentUser):
    group = await _get_group(db, group_id, current_user)
    membership = await _membership(db, group.id, current_user.id)
    target = await _membership(db, group.id, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="That person is not in this group.")

    is_self = user_id == current_user.id
    if not is_self and not _can_manage(current_user, membership):
        raise HTTPException(status_code=403, detail="Only group owners and admins can remove members.")
    if target.role == ChatGroupRole.OWNER and not is_self and not _is_org_admin(current_user):
        raise HTTPException(status_code=403, detail="The group owner can't be removed.")

    if target.role == ChatGroupRole.OWNER:
        # Hand ownership to the longest-standing remaining admin/member
        successor = (await db.execute(
            select(ChatGroupMember)
            .where(ChatGroupMember.group_id == group.id, ChatGroupMember.user_id != user_id)
            .order_by(
                (ChatGroupMember.role != ChatGroupRole.ADMIN),  # admins first
                ChatGroupMember.joined_at,
            )
            .limit(1)
        )).scalar_one_or_none()
        if successor:
            successor.role = ChatGroupRole.OWNER

    await db.delete(target)
    await db.commit()

    remaining = await _member_ids(db, group.id)
    if not remaining:
        group.is_archived = True
        await db.commit()
    await _broadcast_group_updated(db, group, extra_user_ids=[str(user_id)])
    return APIResponse.success(message="Left the group." if is_self else "Member removed.")


@router.patch("/groups/{group_id}/members/{user_id}")
async def update_member_role(group_id: uuid.UUID, user_id: uuid.UUID, payload: ChatGroupMemberRoleUpdate,
                             db: DB, current_user: CurrentUser):
    group = await _get_group(db, group_id, current_user)
    membership = await _membership(db, group.id, current_user.id)
    if not _can_manage(current_user, membership):
        raise HTTPException(status_code=403, detail="Only group owners and admins can change roles.")
    target = await _membership(db, group.id, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="That person is not in this group.")
    if target.role == ChatGroupRole.OWNER:
        raise HTTPException(status_code=400, detail="The owner's role can't be changed.")
    target.role = payload.role
    await db.commit()
    await _broadcast_group_updated(db, group)
    return APIResponse.success(message="Role updated.")


# ─────────────────────────────────────────────────────────────────────────────
# Group messages
# ─────────────────────────────────────────────────────────────────────────────

async def _require_member(db, group_id: uuid.UUID, user: User) -> tuple[ChatGroup, ChatGroupMember]:
    group = await _get_group(db, group_id, user)
    membership = await _membership(db, group.id, user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this group.")
    return group, membership


@router.get("/groups/{group_id}/messages", response_model=list[GroupMessageRead])
async def list_group_messages(group_id: uuid.UUID, db: DB, current_user: CurrentUser,
                              before: datetime | None = None, limit: int = 50):
    await _require_member(db, group_id, current_user)
    limit = max(1, min(limit, 100))
    stmt = (
        select(Message, User.full_name, User.avatar_url)
        .options(selectinload(Message.attachments))
        .join(User, User.id == Message.sender_id)
        .where(Message.group_id == group_id)
    )
    if before:
        stmt = stmt.where(Message.created_at < before)
    rows = (await db.execute(stmt.order_by(desc(Message.created_at)).limit(limit))).all()
    data = [
        GroupMessageRead(**_message_dict(m), sender_name=name, sender_avatar=avatar)
        for m, name, avatar in reversed(rows)
    ]
    return APIResponse.success(message="Messages retrieved.", data=data)


def _message_dict(m: Message) -> dict:
    return {
        "id": m.id, "sender_id": m.sender_id, "receiver_id": m.receiver_id, "group_id": m.group_id,
        "content": m.content, "is_read": m.is_read, "created_at": m.created_at,
        "attachments": [AttachmentRead.model_validate(a) for a in m.attachments],
    }


@router.post("/groups/{group_id}/messages", response_model=GroupMessageRead)
async def send_group_message(group_id: uuid.UUID, payload: GroupMessageCreate, db: DB, current_user: CurrentUser):
    group, membership = await _require_member(db, group_id, current_user)
    if group.is_archived:
        raise HTTPException(status_code=400, detail="This group is archived.")

    message = Message(sender_id=current_user.id, group_id=group.id, content=payload.content.strip())
    db.add(message)
    await db.flush()
    await link_attachments(db, payload.attachment_ids, current_user, message)
    membership.last_read_at = datetime.now(timezone.utc)
    await db.commit()
    message = await load_message(db, message.id)

    out = GroupMessageRead(**_message_dict(message), sender_name=current_user.full_name,
                           sender_avatar=current_user.avatar_url)
    ws_payload = out.model_dump(mode="json") | {
        "group_name": group.name,
        "preview": message_preview(message),
    }
    await ws_manager.broadcast_to_users(await _member_ids(db, group.id), "group_message", ws_payload)
    return APIResponse.success(message="Message sent.", data=out)


@router.post("/groups/{group_id}/read")
async def mark_group_read(group_id: uuid.UUID, db: DB, current_user: CurrentUser):
    _, membership = await _require_member(db, group_id, current_user)
    membership.last_read_at = datetime.now(timezone.utc)
    await db.commit()
    return APIResponse.success(message="Marked as read.")
