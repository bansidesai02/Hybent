import logging
from jose import JWTError
from starlette.types import ASGIApp, Scope, Receive, Send
from app.utils.security import decode_access_token

logger = logging.getLogger(__name__)

PUBLIC_PATHS = {
    "/", "/docs", "/openapi.json", "/redoc", "/health",
    "/v1/auth/login", "/v1/auth/register", "/v1/auth/refresh",
}


class TenantMiddleware:
    """
    Extracts org_id + user_id from the Bearer token and attaches them to
    scope["state"] so routers can use them without re-decoding.
    Uses raw ASGI interface to avoid BaseHTTPMiddleware overhead.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        if "state" not in scope:
            scope["state"] = {}

        scope["state"]["user_id"] = None
        scope["state"]["org_id"] = None

        path = scope.get("path", "")
        if path in PUBLIC_PATHS or path.startswith("/static"):
            await self.app(scope, receive, send)
            return

        # Find authorization header
        auth_header = b""
        for name, value in scope.get("headers", []):
            if name == b"authorization":
                auth_header = value
                break

        if auth_header.startswith(b"Bearer "):
            try:
                token = auth_header[7:].decode("utf-8")
                payload = decode_access_token(token)
                scope["state"]["user_id"] = payload.get("sub")
                scope["state"]["org_id"] = payload.get("org")
            except (JWTError, UnicodeDecodeError):
                pass  # invalid token handled by auth dependency

        await self.app(scope, receive, send)
