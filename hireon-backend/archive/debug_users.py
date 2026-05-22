
import asyncio
from sqlalchemy import select, text
from app.database import engine

async def debug_db():
    async with engine.connect() as conn:
        print("\n--- USERS ---", flush=True)
        result = await conn.execute(text("SELECT id, email, role, organization_id, is_active FROM users"))
        for row in result:
            print(f"ID: {row[0]} | Email: {row[1]} | Role: {row[2]} | OrgID: {row[3]} | Active: {row[4]}", flush=True)
        
        print("\n--- ORGANIZATIONS ---", flush=True)
        result = await conn.execute(text("SELECT id, name, slug FROM organizations"))
        for row in result:
            print(f"ID: {row[0]} | Name: {row[1]} | Slug: {row[2]}", flush=True)

if __name__ == "__main__":
    asyncio.run(debug_db())
