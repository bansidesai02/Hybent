import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.database_url)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def main():
    async with Session() as db:
        oid = "358f87f6-5b6d-46f4-bb33-ed4ff6231f42"
        job_title = "OdooPython"
        
        # Run raw count of OdooPython applications
        count_res = await db.execute(text("""
            SELECT COUNT(*) 
            FROM candidates c
            JOIN applications a ON a.candidate_id = c.id
            JOIN jobs j ON j.id = a.job_id
            WHERE j.organization_id = :oid AND j.title ILIKE :jt
        """), {"oid": oid, "jt": f"%{job_title}%"})
        print("Total applications for OdooPython:", count_res.scalar())
        
        # List candidate names and their match scores
        res_list = await db.execute(text("""
            SELECT c.full_name, a.match_score, c.email
            FROM candidates c
            JOIN applications a ON a.candidate_id = c.id
            JOIN jobs j ON j.id = a.job_id
            WHERE j.organization_id = :oid AND j.title ILIKE :jt
            ORDER BY a.match_score DESC NULLS LAST, c.created_at DESC
        """), {"oid": oid, "jt": f"%{job_title}%"})
        
        print("\nAll OdooPython candidates:")
        rows = res_list.fetchall()
        for r in rows:
            print(f"- {r.full_name} | Match score: {r.match_score} | Email: {r.email}")

if __name__ == "__main__":
    asyncio.run(main())
