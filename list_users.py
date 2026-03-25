import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select
from app.database import get_session_factory
from app.models.user import User

async def list_users():
    async with get_session_factory()() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        for u in users:
            print(f"{u.id}: {u.email} ({u.role})")

if __name__ == "__main__":
    asyncio.run(list_users())
