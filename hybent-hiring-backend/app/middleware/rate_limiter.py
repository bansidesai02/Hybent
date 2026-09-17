"""
Sliding window rate limiter middleware for FastAPI.
Protects sensitive authentication and API endpoints against brute-force attacks and abuse.
Backed by Redis with fallback to in-memory storage.
"""
import time
from collections import defaultdict
from typing import Dict, List
import logging
import redis.asyncio as aioredis

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, auth_limit: int = 10, api_limit: int = 120, window_seconds: int = 60):
        super().__init__(app)
        self.auth_limit = auth_limit
        self.api_limit = api_limit
        self.window_seconds = window_seconds
        # Storage fallback: ip -> list of timestamps
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._redis = None

    def _clean_old_requests(self, ip: str, now: float):
        cutoff = now - self.window_seconds
        self._requests[ip] = [ts for ts in self._requests[ip] if ts > cutoff]

    async def _check_rate_limit_redis(self, client_ip: str, limit: int, is_auth: bool, now: float) -> tuple[bool, int]:
        """Verify rate limit using Redis zset. Returns (is_allowed, current_count)."""
        if self._redis is None:
            self._redis = aioredis.from_url(settings.redis_url)
        
        # Redis key name
        key = f"rate_limit:{client_ip}:{'auth' if is_auth else 'api'}"
        cutoff = now - self.window_seconds
        
        async with self._redis.pipeline(transaction=True) as pipe:
            # 1. Remove elements older than the sliding window
            pipe.zremrangebyscore(key, 0, cutoff)
            # 2. Add current timestamp
            pipe.zadd(key, {str(now): now})
            # 3. Retrieve all members in window to count
            pipe.zcard(key)
            # 4. Set expiry to ensure automatic cleanup of idle keys
            pipe.expire(key, self.window_seconds)
            # Execute pipeline
            _, _, count, _ = await pipe.execute()
            
        return count <= limit, count

    async def dispatch(self, request: Request, call_next):
        # Skip health check endpoints, OPTIONS preflight, and static assets
        path = request.url.path
        if request.method == "OPTIONS" or path in ["/", "/health", "/docs", "/openapi.json", "/redoc"] or path.startswith("/static/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "127.0.0.1"
        # Check X-Forwarded-For if behind reverse proxy / load balancer
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        now = time.time()
        is_auth_endpoint = "/auth/login" in path or "/auth/register" in path or "/auth/forgot-password" in path or "/auth/reset-password" in path
        limit = self.auth_limit if is_auth_endpoint else self.api_limit

        # Try Redis Rate Limiting first
        use_fallback = False
        allowed = True
        current_count = 0
        try:
            allowed, current_count = await self._check_rate_limit_redis(client_ip, limit, is_auth_endpoint, now)
        except Exception as e:
            logger.warning(f"Redis rate limiting failed: {e}. Falling back to in-memory limiter.")
            use_fallback = True
            self._redis = None  # Reset client to attempt reconnect next time

        # Fallback to local memory limiter if Redis fails
        if use_fallback:
            self._clean_old_requests(client_ip, now)
            self._requests[client_ip].append(now)
            current_count = len(self._requests[client_ip])
            allowed = current_count <= limit

        if not allowed:
            logger.warning(f"Rate limit exceeded for IP {client_ip} on path {path} ({current_count}/{limit} reqs)")
            headers = {"Retry-After": str(self.window_seconds)}
            origin = request.headers.get("origin")
            if origin:
                headers["Access-Control-Allow-Origin"] = origin
                headers["Access-Control-Allow-Credentials"] = "true"
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "message": f"Too many requests. Rate limit of {limit} requests per minute exceeded. Please try again later.",
                    "data": None,
                    "error": "Rate limit exceeded"
                },
                headers=headers
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - current_count))
        return response
