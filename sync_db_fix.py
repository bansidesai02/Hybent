import asyncio
import sys
import os
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from app.database import get_session_factory

async def fix_schema():
    async with get_session_factory()() as db:
        # 1. Add 'phone' if missing
        try:
            await db.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50)"))
            print("Added 'phone' column to 'users'")
        except Exception as e:
            print(f"Skipping 'phone' column: {e}")

        # 2. Add 'fcm_token' if missing
        try:
            await db.execute(text("ALTER TABLE users ADD COLUMN fcm_token VARCHAR(500)"))
            print("Added 'fcm_token' column to 'users'")
        except Exception as e:
            print(f"Skipping 'fcm_token' column: {e}")

        # 3. Add 'linkedin_access_token' if missing
        try:
            await db.execute(text("ALTER TABLE users ADD COLUMN linkedin_access_token VARCHAR(2000)"))
            print("Added 'linkedin_access_token' column to 'users'")
        except Exception as e:
            print(f"Skipping 'linkedin_access_token' column: {e}")

        await db.commit()
        print("Schema sync complete!")

if __name__ == "__main__":
    asyncio.run(fix_schema())
