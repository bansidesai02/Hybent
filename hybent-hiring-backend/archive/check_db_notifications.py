
import asyncio
import uuid
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.notification import Notification

async def check_latest_notifications():
    async with AsyncSessionLocal() as db:
        print("Fetching latest notifications...")
        query = select(Notification).order_by(Notification.created_at.desc()).limit(10)
        result = await db.execute(query)
        notifications = result.scalars().all()
        
        if not notifications:
            print("No notifications found in the database.")
            return

        for n in notifications:
            print(f"[{n.created_at}] ID: {n.id} | Type: {n.type} | Title: {n.title} | User: {n.user_id}")
            print(f"  Message: {n.message}")
            print(f"  Data: {n.data}")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check_latest_notifications())
