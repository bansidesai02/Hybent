import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.config import settings

engine = create_async_engine(settings.database_url)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def main():
    async with Session() as db:
        res = await db.execute(text("""
            SELECT c.full_name, c.email, j.title, c.skills
            FROM candidates c
            LEFT JOIN applications a ON a.candidate_id = c.id
            LEFT JOIN jobs j ON j.id = a.job_id
            WHERE c.full_name ILIKE '%rohan%' OR c.full_name ILIKE '%priya%'
        """))
        rows = res.fetchall()
        for r in rows:
            print(f"- {r.full_name} | Job: {r.title} | Skills: {r.skills}")

if __name__ == "__main__":
    asyncio.run(main())
