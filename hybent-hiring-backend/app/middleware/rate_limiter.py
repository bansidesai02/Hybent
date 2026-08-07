"""
Sliding window rate limiter middleware for FastAPI.
Protects sensitive authentication and API endpoints against brute-force attacks and abuse.
"""
import time
from collections import defaultdict
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, auth_limit: int = 10, api_limit: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.auth_limit = auth_limit
        self.api_limit = api_limit
        self.window_seconds = window_seconds
        # Storage: ip -> list of timestamps
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def _clean_old_requests(self, ip: str, now: float):
        cutoff = now - self.window_seconds
        self._requests[ip] = [ts for ts in self._requests[ip] if ts > cutoff]

    async def dispatch(self, request: Request, call_next):
        # Skip health check endpoints and static assets
        path = request.url.path
        if path in ["/", "/health", "/docs", "/openapi.json", "/redoc"] or path.startswith("/static/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        # Check X-Forwarded-For if behind reverse proxy / load balancer
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        now = time.time()
        self._clean_old_requests(client_ip, now)

        # Determine rate limit threshold based on endpoint sensitivity
        is_auth_endpoint = "/auth/login" in path or "/auth/register" in path or "/auth/forgot-password" in path or "/auth/reset-password" in path
        limit = self.auth_limit if is_auth_endpoint else self.api_limit

        current_count = len(self._requests[client_ip])
        if current_count >= limit:
            logger.warning(f"Rate limit exceeded for IP {client_ip} on path {path} ({current_count}/{limit} reqs)")
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "message": f"Too many requests. Rate limit of {limit} requests per minute exceeded. Please try again later.",
                    "data": None,
                    "error": "Rate limit exceeded"
                },
                headers={"Retry-After": str(self.window_seconds)}
            )

        self._requests[client_ip].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(limit - len(self._requests[client_ip]))
        return response
