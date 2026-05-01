import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import settings

engine = create_async_engine(settings.database_url)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def clear_avatars():
    async with Session() as db:
        print("🧹 Clearing all user avatar URLs...")
        await db.execute(text("UPDATE users SET avatar_url = NULL"))
        await db.commit()
        print("✅ Done!")

if __name__ == "__main__":
    asyncio.run(clear_avatars())
