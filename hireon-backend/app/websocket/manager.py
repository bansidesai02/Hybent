"""
WebSocket connection manager.
Maps user_id → list of active WebSocket connections.
Supports multiple browser tabs per user.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis
from fastapi import WebSocket

from app.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id (str) → list of active WebSockets
        self._connections: dict[str, list[WebSocket]] = {}
        # user_id → org_id (str)
        self._user_orgs: dict[str, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str, org_id: str | None = None) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        if org_id:
            self._user_orgs[user_id] = org_id
        logger.info(f"WS connected: user={user_id}, org={org_id}, total_connections={self.total}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws is not websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]
                if user_id in self._user_orgs:
                    del self._user_orgs[user_id]
        logger.info(f"WS disconnected: user={user_id}, total_connections={self.total}")

    async def send_to_user(self, user_id: str, event: str, data: Any, publish: bool = True) -> None:
        """Push a JSON event to all WebSocket connections for a user."""
        # 1. Local send to connections in this process
        if user_id in self._connections:
            message = json.dumps({
                "type": "event",
                "event": event,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            dead = []
            for ws in self._connections[user_id]:
                try:
                    await ws.send_text(message)
                except Exception:
                    dead.append(ws)

            # Remove dead connections
            if dead:
                for ws in dead:
                    self._connections[user_id] = [
                        c for c in self._connections[user_id] if c is not ws
                    ]
                if not self._connections[user_id]:
                    del self._connections[user_id]
        
        # 2. Publish to Redis so other processes can also send to their local connections
        if publish:
            await self.publish_notification(user_id, event, data)

    async def broadcast_to_org(self, org_id: str, event: str, data: Any, exclude_user_id: str | None = None) -> None:
        """Push an event to all connected users in an organization."""
        # 1. Local broadcast
        for user_id, user_org in self._user_orgs.items():
            if user_org == org_id and user_id != exclude_user_id:
                await self.send_to_user(user_id, event, data, publish=False)
        
        # 2. Redis broadcast
        await self.publish_notification(user_id=None, event=event, data=data, org_id=org_id, exclude_user_id=exclude_user_id)

    async def broadcast_to_users(self, user_ids: list[str], event: str, data: Any) -> None:
        """Push an event to specific users."""
        for user_id in user_ids:
            await self.send_to_user(user_id, event, data)

    @property
    def total(self) -> int:
        return sum(len(v) for v in self._connections.values())

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._connections and bool(self._connections[user_id])

    # ── Redis Pub/Sub for Cross-Process Broadcasting ──────────────────────────
    
    async def publish_notification(self, user_id: str | None, event: str, data: Any, org_id: str | None = None, exclude_user_id: str | None = None) -> None:
        """Publish a notification event to Redis Pub/Sub."""
        try:
            r = redis.from_url(settings.redis_url)
            message = json.dumps({
                "user_id": user_id,
                "org_id": org_id,
                "exclude_user_id": exclude_user_id,
                "event": event,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await r.publish("ws_notifications", message)
            await r.aclose()
        except Exception as e:
            logger.error(f"Failed to publish to Redis Pub/Sub: {e}")

    async def listen_to_redis(self) -> None:
        """Background task to listen for notifications from other processes."""
        try:
            r = redis.from_url(settings.redis_url)
            pubsub = r.pubsub()
            await pubsub.subscribe("ws_notifications")
            
            logger.info("Started listening to Redis ws_notifications channel")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        payload = json.loads(message["data"])
                        user_id = payload.get("user_id")
                        org_id = payload.get("org_id")
                        exclude_id = payload.get("exclude_user_id")
                        event = payload.get("event")
                        data = payload.get("data")
                        
                        if event:
                            if user_id:
                                await self.send_to_user(user_id, event, data, publish=False)
                            elif org_id:
                                # Broadcast to all local users in this org
                                for uid, uorg in self._user_orgs.items():
                                    if uorg == org_id and uid != exclude_id:
                                        await self.send_to_user(uid, event, data, publish=False)
                    except Exception as e:
                        logger.error(f"Error processing Redis WS message: {e}")
        except Exception as e:
            logger.error(f"Redis Pub/Sub listener failed: {e}")
        finally:
            if 'r' in locals():
                await r.aclose()


    async def send_push_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        """
        Send an OS-level Firebase push notification to a user's registered device.
        Always fires regardless of WebSocket connection state.
        """
        try:
            from sqlalchemy import select as sa_select
            from app.models.user import User
            from app.services.firebase_service import send_push
            from app.database import AsyncSessionLocal
            import uuid

            async with AsyncSessionLocal() as db:
                # Ensure user_id is a UUID object for the query
                uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
                result = await db.execute(sa_select(User).where(User.id == uid))
                user = result.scalar_one_or_none()
                if user and user.fcm_token:
                    await send_push(user.fcm_token, title, body, data or {})

        except Exception as e:
            logger.error(f"[FCM] send_push_notification failed for user {user_id}: {e}")



# Global singleton used across the app
ws_manager = ConnectionManager()
