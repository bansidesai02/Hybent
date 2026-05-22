from sqlalchemy import select
from app.models.user import User
from app.database import AsyncSessionLocal
import asyncio

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.fcm_token != None))
        users = result.scalars().all()
        print(f"Users with token: {len(users)}")
        for u in users:
            print(f"User: {u.email}, Token: {u.fcm_token[:10]}...")

if __name__ == '__main__':
    asyncio.run(check())
