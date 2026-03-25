import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.user import User
from app.models.application import Application
from app.models.candidate import Candidate

# Explicitly use 5433 for Docker Postgres
DB_URL = "postgresql+asyncpg://hireon:12345@localhost:5433/hireon_db"

async def debug_docker_db():
    engine = create_async_engine(DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    
    async with session_factory() as db:
        # 1. Upgrade user
        await db.execute(
            update(User)
            .where(User.email == "dhrumithakkar30@gmail.com")
            .values(role="admin")
        )
        await db.commit()
        print("User upgraded to admin in Docker DB.")
        
        # 2. Check counts
        result = await db.execute(select(User).where(User.email == "dhrumithakkar30@gmail.com"))
        user = result.scalar_one_or_none()
        
        if not user:
            print("User dhrumithakkar30@gmail.com NOT FOUND in Docker DB (5433).")
            # List some users
            res = await db.execute(select(User.email).limit(10))
            emails = res.scalars().all()
            print(f"Users in DB: {emails}")
            return

        app_count = (await db.execute(select(func.count(Application.id)).where(Application.organization_id == user.organization_id))).scalar()
        cand_count = (await db.execute(select(func.count(Candidate.id)).where(Candidate.organization_id == user.organization_id))).scalar()
        
        print(f"User Role: {user.role}, Org ID: {user.organization_id}")
        print(f"Apps in Org: {app_count}")
        print(f"Cands in Org: {cand_count}")
        
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(debug_docker_db())
