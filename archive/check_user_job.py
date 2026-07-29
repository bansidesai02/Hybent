import asyncio
import sys
import os
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.models.job import Job

async def check_user_job():
    async with get_session_factory()() as db:
        user = (await db.execute(select(User).where(User.email == "dhrumithakkar30@gmail.com"))).scalar_one()
        print(f"User ID: {user.id}")
        
        job = (await db.execute(select(Job).limit(1))).scalar_one()
        print(f"First Job Created By: {job.created_by_id}")

if __name__ == "__main__":
    asyncio.run(check_user_job())
