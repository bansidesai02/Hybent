import json
import logging
import time
import asyncio
from typing import Callable
from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Logs all state-changing requests to the audit_logs table.
    Skips GET, HEAD, OPTIONS, and auth endpoints.
    """

    SKIP_METHODS = {"GET", "HEAD", "OPTIONS"}
    SKIP_PATHS = {"/docs", "/openapi.json", "/redoc", "/v1/auth/login", "/v1/auth/register", "/health"}

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in self.SKIP_METHODS:
            return await call_next(request)

        if any(request.url.path.startswith(p) for p in self.SKIP_PATHS):
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        # Extract user info from request state (set by auth dependency)
        user_id = getattr(request.state, "user_id", None)
        org_id = getattr(request.state, "org_id", None)

        # Parse resource info from path: /v1/{resource}/{id}
        parts = request.url.path.strip("/").split("/")
        resource_type = parts[2] if len(parts) > 2 else "unknown"
        resource_id = parts[3] if len(parts) > 3 else None

        # If it's a creation (POST) and resource_id is None, try to get it from the response body
        if not resource_id and request.method == "POST" and response.status_code == 201:
            try:
                location = response.headers.get("Location")
                if location:
                    resource_id = location.strip("/").split("/")[-1]
            except Exception:
                pass

        action_map = {"POST": "CREATE", "PUT": "UPDATE", "PATCH": "UPDATE", "DELETE": "DELETE"}
        action = action_map.get(request.method, request.method)

        logger.info(
            f"AUDIT | {action} {resource_type} "
            f"resource_id={resource_id} user={user_id} org={org_id} "
            f"status={response.status_code} duration={duration_ms:.1f}ms"
        )

        # ── Real-time Activity Broadcast (WhatsApp-style popups) ─────────────
        if resource_type in {"job", "candidate", "interview", "application", "scorecard", "offer"}:
            if 200 <= response.status_code < 300 and org_id:
                # Format a friendly message for the toast
                message = f"{action.capitalize()}d {resource_type}"
                
                # Use a background task to not block the current response
                asyncio.create_task(ws_manager.broadcast_to_org(
                    org_id=str(org_id),
                    event="activity_created",
                    data={
                        "user_id": str(user_id) if user_id else None,
                        "action": action,
                        "resource_type": resource_type,
                        "resource_id": str(resource_id) if resource_id else None,
                        "message": message,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    },
                    exclude_user_id=str(user_id) if user_id else None
                ))

        return response
