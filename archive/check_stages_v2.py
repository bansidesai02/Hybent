import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.application import Application

# Explicitly use 5433 for Docker Postgres
DB_URL = "postgresql+asyncpg://hireon:12345@localhost:5433/hireon_db"

async def check_stages():
    engine = create_async_engine(DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with session_factory() as db:
        res = await db.execute(select(Application.stage))
        stages = res.scalars().all()
        print(f"All stages in DB: {stages}")
        
        # Breakdown
        counts = {}
        for s in stages:
            counts[s] = counts.get(s, 0) + 1
        print(f"Stage counts: {counts}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_stages())
