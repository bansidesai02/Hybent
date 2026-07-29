import asyncio
from app.core.database import AsyncSessionLocal
from app.models.job import Job
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Job).where(Job.title.ilike("%vue%")))
        jobs = res.scalars().all()
        print(f"Found {len(jobs)} Vue jobs.")
        for j in jobs:
            print(f"\nID: {j.id}")
            print(f"Title: {j.title}")
            print(f"Description: {repr(j.description)}")
            print(f"Requirements: {repr(j.requirements)}")
            print(f"Responsibilities: {repr(j.responsibilities)}")
            print(f"Skills Required: {j.skills_required}")

if __name__ == '__main__':
    asyncio.run(main())
