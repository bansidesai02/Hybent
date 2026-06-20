import asyncio
from sqlalchemy import text
from app.database import get_session_factory

async def check():
    session = get_session_factory()()
    async with session:
        sql = """
            SELECT 
                NOW() AS db_now,
                NOW() AT TIME ZONE 'UTC' AS db_now_utc,
                DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') AS day_trunc_utc,
                DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC') AS week_trunc_utc
        """
        res = await session.execute(text(sql))
        row = dict(res.fetchone()._mapping)
        print("Postgres Time Info:")
        for k, v in row.items():
            print(f" - {k}: {v}")

if __name__ == '__main__':
    asyncio.run(check())
