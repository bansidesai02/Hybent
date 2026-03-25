import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.application import Application
from app.models.candidate import Candidate

DB_URL = "postgresql+asyncpg://hireon:12345@localhost:5433/hireon_db"

async def audit_v3():
    engine = create_async_engine(DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with session_factory() as db:
        res = await db.execute(
            select(Candidate.full_name, Application.stage)
            .join(Candidate, Application.candidate_id == Candidate.id)
        )
        data = res.all()
        print(f"REPORT: Found {len(data)} applications.")
        for name, stage in data:
            print(f"NAME: {name} | STAGE: {stage}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(audit_v3())
