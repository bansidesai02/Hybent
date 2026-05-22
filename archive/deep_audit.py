import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.user import User
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.organization import Organization

# Explicitly use 5433 for Docker Postgres
DB_URL = "postgresql+asyncpg://hireon:12345@localhost:5433/hireon_db"

async def deep_audit():
    engine = create_async_engine(DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with session_factory() as db:
        # 1. Total Organizations
        org_res = await db.execute(select(Organization.name, Organization.id))
        orgs = org_res.all()
        print(f"Total Orgs: {len(orgs)}")
        for name, oid in orgs:
            print(f" - {name} ({oid})")
            
        # 2. Total Users per Org
        for name, oid in orgs:
            user_count = (await db.execute(select(func.count(User.id)).where(User.organization_id == oid))).scalar()
            print(f" - {name} has {user_count} users")
            
        # 3. Total Candidates & Apps per Org
        for name, oid in orgs:
            cand_count = (await db.execute(select(func.count(Candidate.id)).where(Candidate.organization_id == oid))).scalar()
            app_count = (await db.execute(select(func.count(Application.id)).where(Application.organization_id == oid))).scalar()
            print(f" - {name} has {cand_count} candidates and {app_count} applications")
            
        # 4. List all Candidate names in the DB
        cand_res = await db.execute(select(Candidate.full_name, Candidate.organization_id))
        cands = cand_res.all()
        print(f"Total Candidates in global DB: {len(cands)}")
        for name, oid in cands:
            print(f" - {name} (Org: {oid})")
            
        # 5. List all Application stages in the DB
        app_res = await db.execute(select(Application.stage, Application.organization_id))
        apps = app_res.all()
        print(f"Total Applications in global DB: {len(apps)}")
        for stage, oid in apps:
            print(f" - Stage: {stage} (Org: {oid})")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(deep_audit())
