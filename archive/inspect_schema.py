import asyncio
import sys
import os
from sqlalchemy import text

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory

async def inspect():
    async with get_session_factory()() as db:
        for table in ['users', 'organizations']:
            res = await db.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'"))
            cols = res.all()
            print(f"Table '{table}':")
            for c in cols:
                print(f" - {c[0]} ({c[1]})")

if __name__ == "__main__":
    asyncio.run(inspect())
