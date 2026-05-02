import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_, and_, func, desc
from sqlalchemy.orm import selectinload

from app.dependencies import DB, CurrentUser
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate, MessageRead, ConversationSummary
from app.schemas.response import APIResponse
from app.websocket.manager import ws_manager
from app.utils.permissions import UserRole, NotificationType
from app.tasks.notifications import send_system_notification

router = APIRouter(prefix="/v1/messages", tags=["messages"])


@router.post("", response_model=MessageRead)
async def send_message(
    payload: MessageCreate,
    db: DB,
    current_user: CurrentUser,
):
    # 1. Validate receiver exists
    result = await db.execute(select(User).where(User.id == payload.receiver_id))
    receiver = result.scalar_one_or_none()
    
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    
    # Organization isolation
    if receiver.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Cannot message users outside your organization")

    # 2. Create message
    new_message = Message(
        sender_id=current_user.id,
        receiver_id=payload.receiver_id,
        content=payload.content.strip(),
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    # 3. Notify receiver via WebSocket (Direct Message)
    message_data = {
        "id": str(new_message.id),
        "sender_id": str(new_message.sender_id),
        "sender_name": current_user.full_name,
        "sender_avatar": current_user.avatar_url,
        "receiver_id": str(payload.receiver_id),
        "receiver_name": receiver.full_name,
        "receiver_avatar": receiver.avatar_url,
        "content": new_message.content,
        "created_at": new_message.created_at.isoformat(),
    }
    await ws_manager.send_to_user(str(payload.receiver_id), "new_message", message_data)
    
    # Notify sender as well (for multi-tab sync)
    await ws_manager.send_to_user(str(current_user.id), "new_message", message_data)

    # 4. Trigger System Notification (Bell Alert)
    # This ensures the user gets a red dot/alert if they aren't looking at the chat
    send_system_notification.delay(
        str(payload.receiver_id),
        str(current_user.organization_id),
        NotificationType.MESSAGE_RECEIVED,
        "New Message Received 💬",
        f"You have a new message from {current_user.full_name}: \"{new_message.content[:50]}...\"",
        {"sender_id": str(current_user.id)},
        persist=False
    )

    return APIResponse.success(
        message="Message sent.",
        data=MessageRead.model_validate(new_message)
    )


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    db: DB,
    current_user: CurrentUser,
):
    """
    Get a list of users the current user has chatted with,
    including the latest message and unread count.
    """
    # This is a complex query to get the last message for each conversation
    # For simplicity in this version, we'll fetch all messages where the user is involved
    # and group them in Python. In a high-traffic app, this should be optimized in SQL.
    
    # Subquery to find all unique "other" users
    stmt = select(Message.sender_id, Message.receiver_id).where(
        or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id)
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    other_user_ids = set()
    for s_id, r_id in rows:
        if s_id != current_user.id:
            other_user_ids.add(s_id)
        if r_id != current_user.id:
            other_user_ids.add(r_id)
    
    conversations = []
    for other_id in other_user_ids:
        # Get last message
        last_msg_stmt = (
            select(Message)
            .where(
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == other_id),
                    and_(Message.sender_id == other_id, Message.receiver_id == current_user.id),
                )
            )
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg_res = await db.execute(last_msg_stmt)
        last_msg = last_msg_res.scalar_one_or_none()
        
        # Get unread count
        unread_stmt = select(func.count(Message.id)).where(
            Message.sender_id == other_id, 
            Message.receiver_id == current_user.id,
            Message.is_read == False
        )
        unread_res = await db.execute(unread_stmt)
        unread_count = unread_res.scalar()
        
        # Get other user details
        user_stmt = select(User).where(User.id == other_id)
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()
        
        if last_msg and user:
            conversations.append(ConversationSummary(
                other_user_id=other_id,
                other_user_full_name=user.full_name,
                other_user_avatar_url=user.avatar_url,
                last_message=last_msg.content,
                last_message_at=last_msg.created_at,
                unread_count=unread_count
            ))
    
    # Sort by latest message
    conversations.sort(key=lambda x: x.last_message_at, reverse=True)
    
    return APIResponse.success(message="Conversations retrieved.", data=conversations)


@router.get("/{other_user_id}", response_model=List[MessageRead])
async def get_messages(
    other_user_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
    limit: int = 50,
    offset: int = 0
):
    # 1. Fetch messages
    stmt = (
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == current_user.id),
            )
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    
    # 2. Mark messages from other_user as read
    unread_msgs_stmt = (
        select(Message)
        .where(
            Message.sender_id == other_user_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False
        )
    )
    unread_result = await db.execute(unread_msgs_stmt)
    unread_messages = unread_result.scalars().all()
    
    for msg in unread_messages:
        msg.is_read = True
    
    if unread_messages:
        await db.commit()
        # Notify the sender that their messages were read
        await ws_manager.send_to_user(
            str(other_user_id),
            "messages_read",
            {
                "reader_id": str(current_user.id),
                "message_ids": [str(msg.id) for msg in unread_messages]
            }
        )

    # Return in chronological order for the UI
    return APIResponse.success(
        message="Conversation retrieved.",
        data=[MessageRead.model_validate(m) for m in reversed(list(messages))]
    )


@router.post("/{other_user_id}/read")
async def mark_messages_as_read(
    other_user_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    """
    Manually mark all messages from a specific user as read.
    Used when a new message arrives and the chat is already open.
    """
    unread_msgs_stmt = (
        select(Message)
        .where(
            Message.sender_id == other_user_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False
        )
    )
    unread_result = await db.execute(unread_msgs_stmt)
    unread_messages = unread_result.scalars().all()
    
    if not unread_messages:
        return APIResponse.success(message="No unread messages.")

    for msg in unread_messages:
        msg.is_read = True
    
    await db.commit()

    # Notify the sender
    await ws_manager.send_to_user(
        str(other_user_id),
        "messages_read",
        {
            "reader_id": str(current_user.id),
            "message_ids": [str(msg.id) for msg in unread_messages]
        }
    )

    return APIResponse.success(message="Messages marked as read.")
