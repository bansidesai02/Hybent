import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(settings.database_url)
Session = async_sessionmaker(engine, expire_on_commit=False)

async def main():
    async with Session() as db:
        # User details
        user_res = await db.execute(text("SELECT id, organization_id, email, role FROM users"))
        for u in user_res.fetchall():
            print(f"User: {u.email} | Role: {u.role} | Org: {u.organization_id}")
            
        # Jobs list
        job_res = await db.execute(text("SELECT id, title, organization_id, status FROM jobs"))
        print("\nJobs in DB:")
        for j in job_res.fetchall():
            print(f"- Job: {j.title} | Org: {j.organization_id} | Status: {j.status}")
            
        # Applications count per job
        app_res = await db.execute(text("""
            SELECT j.title, j.organization_id, COUNT(*) AS count
            FROM applications a
            JOIN jobs j ON j.id = a.job_id
            GROUP BY j.title, j.organization_id
        """))
        print("\nApplications per Job:")
        for a in app_res.fetchall():
            print(f"- Job: {a.title} | Org: {a.organization_id} | Count: {a.count}")

if __name__ == "__main__":
    asyncio.run(main())
