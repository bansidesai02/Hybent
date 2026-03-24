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

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"WS connected: user={user_id}, total_connections={self.total}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        if user_id in self._connections:
            self._connections[user_id] = [
                ws for ws in self._connections[user_id] if ws is not websocket
            ]
            if not self._connections[user_id]:
                del self._connections[user_id]
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

    async def broadcast_to_org(self, org_id: str, user_ids: list[str], event: str, data: Any) -> None:
        """Push an event to multiple users (e.g. all recruiters in an org)."""
        for user_id in user_ids:
            await self.send_to_user(user_id, event, data)

    @property
    def total(self) -> int:
        return sum(len(v) for v in self._connections.values())

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._connections and bool(self._connections[user_id])

    # ── Redis Pub/Sub for Cross-Process Broadcasting ──────────────────────────
    
    async def publish_notification(self, user_id: str, event: str, data: Any) -> None:
        """Publish a notification event to Redis Pub/Sub."""
        try:
            r = redis.from_url(settings.redis_url)
            message = json.dumps({
                "user_id": user_id,
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
                        event = payload.get("event")
                        data = payload.get("data")
                        
                        if user_id and event:
                            await self.send_to_user(user_id, event, data, publish=False)
                    except Exception as e:
                        logger.error(f"Error processing Redis WS message: {e}")
        except Exception as e:
            logger.error(f"Redis Pub/Sub listener failed: {e}")
        finally:
            if 'r' in locals():
                await r.aclose()


# Global singleton used across the app
ws_manager = ConnectionManager()
