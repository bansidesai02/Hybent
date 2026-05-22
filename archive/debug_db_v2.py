import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.models.application import Application
from app.models.organization import Organization
from app.models.candidate import Candidate

async def debug_all():
    async with get_session_factory()() as db:
        # 1. Current User
        user = (await db.execute(select(User).where(User.email == "dhrumithakkar30@gmail.com"))).scalar_one()
        print(f"User Emal: {user.email}")
        print(f"User Role: {user.role}")
        print(f"User Org ID: {user.organization_id}")
        
        # 2. Total counts in whole DB
        total_apps = (await db.execute(select(func.count(Application.id)))).scalar()
        total_cands = (await db.execute(select(func.count(Candidate.id)))).scalar()
        print(f"Global - Apps: {total_apps}, Cands: {total_cands}")
        
        # 3. Counts for user's org
        org_apps = (await db.execute(select(func.count(Application.id)).where(Application.organization_id == user.organization_id))).scalar()
        print(f"User Org - Apps: {org_apps}")
        
        # 4. Inspect some applications
        res = await db.execute(select(Application.id, Application.organization_id, Application.job_id).limit(5))
        apps = res.all()
        for app_id, org_id, job_id in apps:
            print(f"App {app_id}: Org {org_id}")

if __name__ == "__main__":
    asyncio.run(debug_all())
