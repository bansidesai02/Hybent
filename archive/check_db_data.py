import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application

async def check_data():
    async with get_session_factory()() as db:
        job_count = (await db.execute(select(func.count(Job.id)))).scalar()
        candidate_count = (await db.execute(select(func.count(Candidate.id)))).scalar()
        app_count = (await db.execute(select(func.count(Application.id)))).scalar()
        
        print(f"Total Jobs: {job_count}")
        print(f"Total Candidates: {candidate_count}")
        print(f"Total Applications: {app_count}")
        
        if job_count > 0:
            latest_jobs = (await db.execute(select(Job.title, Job.created_by_id).limit(5))).all()
            print("Latest Jobs:")
            for title, creator in latest_jobs:
                print(f" - {title} (Created by: {creator})")

if __name__ == "__main__":
    asyncio.run(check_data())
