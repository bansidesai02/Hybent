import logging
import time
import asyncio
from datetime import datetime, timezone

from starlette.types import ASGIApp, Scope, Receive, Send

from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)


class AuditMiddleware:
    """
    Logs all state-changing requests to the audit_logs table.
    Skips GET, HEAD, OPTIONS, and auth endpoints.
    Uses raw ASGI interface to avoid BaseHTTPMiddleware overhead.
    """

    SKIP_METHODS = {"GET", "HEAD", "OPTIONS"}
    SKIP_PATHS = {"/docs", "/openapi.json", "/redoc", "/v1/auth/login", "/v1/auth/register", "/health", "/v1/stripe/webhook"}

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope["method"]
        path = scope["path"]

        if method in self.SKIP_METHODS or any(path.startswith(p) for p in self.SKIP_PATHS):
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        
        status_code = [200]
        response_headers = []

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_code[0] = message["status"]
                response_headers.extend(message.get("headers", []))
            await send(message)

        if "state" not in scope:
            scope["state"] = {}

        await self.app(scope, receive, send_wrapper)

        duration_ms = (time.perf_counter() - start) * 1000
        state = scope["state"]
        user_id = state.get("user_id")
        org_id = state.get("org_id")

        # Parse resource info from path: /v1/{resource}/{id}
        parts = path.strip("/").split("/")
        resource_type = parts[2] if len(parts) > 2 else "unknown"
        resource_id = parts[3] if len(parts) > 3 else None

        # If it's a creation (POST) and resource_id is None, try to get it from Location header
        if not resource_id and method == "POST" and status_code[0] == 201:
            try:
                for k, v in response_headers:
                    if k.lower() == b"location":
                        resource_id = v.decode("utf-8").strip("/").split("/")[-1]
                        break
            except Exception:
                pass

        action_map = {"POST": "CREATE", "PUT": "UPDATE", "PATCH": "UPDATE", "DELETE": "DELETE"}
        action = action_map.get(method, method)

        logger.info(
            f"AUDIT | {action} {resource_type} "
            f"resource_id={resource_id} user={user_id} org={org_id} "
            f"status={status_code[0]} duration={duration_ms:.1f}ms"
        )

        # ── Real-time Activity Broadcast (WhatsApp-style popups) ─────────────
        if resource_type in {"job", "candidate", "interview", "application", "scorecard", "offer"}:
            if 200 <= status_code[0] < 300 and org_id:
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
