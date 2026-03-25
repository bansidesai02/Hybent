import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.application import Application
from app.models.candidate import Candidate

# Explicitly use 5433 for Docker Postgres
DB_URL = "postgresql+asyncpg://hireon:12345@localhost:5433/hireon_db"

async def map_data():
    engine = create_async_engine(DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with session_factory() as db:
        # Join Application and Candidate
        res = await db.execute(
            select(Candidate.full_name, Application.stage, Application.organization_id)
            .join(Candidate, Application.candidate_id == Candidate.id)
        )
        rows = res.all()
        print(f"Total Applications with Candidates: {len(rows)}")
        for name, stage, oid in rows:
            print(f"C: {name} | S: {stage} | Org: {oid}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(map_data())
