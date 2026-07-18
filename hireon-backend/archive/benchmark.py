import asyncio
import time
import httpx
import statistics
import sys
import os

# Add the backend path to sys.path so we can import app modules
sys.path.append(r"e:\BrainerHub Internship\hireon-ai\hireon-backend")

from app.core.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select
from app.utils.security import create_access_token
from datetime import timedelta

async def get_test_token():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No users found in the database. Cannot run protected benchmarks.")
            return None
        
        token = create_access_token(
            data={"sub": str(user.id), "role": user.role, "org": str(user.organization_id)},
            expires_delta=timedelta(minutes=60)
        )
        print(f"Generated token for user {user.email}")
        return token

async def benchmark_endpoint(client, method, url, name, num_requests=20):
    latencies = []
    
    # Warmup
    try:
        await client.request(method, url)
    except Exception:
        pass
        
    print(f"Benchmarking {name}...")
    for _ in range(num_requests):
        start = time.perf_counter()
        res = await client.request(method, url)
        latencies.append(time.perf_counter() - start)
        if res.status_code >= 400:
            print(f"Warning: {name} returned {res.status_code} - {res.text}")
            break
            
    if not latencies:
        return
        
    avg = statistics.mean(latencies)
    p95 = statistics.quantiles(latencies, n=100)[94] if len(latencies) > 1 else latencies[0]
    p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) > 1 else latencies[0]
    print(f"[{name}] Avg: {avg*1000:.2f}ms | P95: {p95*1000:.2f}ms | P99: {p99*1000:.2f}ms")
    print("-" * 50)

async def main():
    token = await get_test_token()
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    async with httpx.AsyncClient(base_url="http://localhost:8000", headers=headers, timeout=10.0) as client:
        # Public
        await benchmark_endpoint(client, "GET", "/health", "Health Check", num_requests=50)
        
        # Protected
        if token:
            await benchmark_endpoint(client, "GET", "/v1/auth/me", "Auth Me", num_requests=20)
            await benchmark_endpoint(client, "GET", "/v1/jobs", "Jobs List", num_requests=20)
            await benchmark_endpoint(client, "GET", "/v1/talent-pool", "Talent Pool", num_requests=20)
            await benchmark_endpoint(client, "GET", "/v1/talent-pool/stats", "Talent Pool Stats", num_requests=20)
            await benchmark_endpoint(client, "GET", "/v1/interviews", "Interviews List", num_requests=20)
            await benchmark_endpoint(client, "GET", "/v1/notifications/unread-count", "Notifications Count", num_requests=20)

if __name__ == "__main__":
    asyncio.run(main())
