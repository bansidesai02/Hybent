import asyncio
import sys
import os
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.models.application import Application
from app.models.organization import Organization

async def debug_orgs():
    async with get_session_factory()() as db:
        # Get first user (likely the one logged in)
        user_res = await db.execute(select(User).limit(5))
        users = user_res.scalars().all()
        for u in users:
            print(f"User: {u.email}, Role: {u.role}, Org ID: {u.organization_id}")
            
        # Get distinct org IDs from applications
        app_org_ids = (await db.execute(select(Application.organization_id).distinct())).scalars().all()
        print(f"Unique Org IDs in Applications: {app_org_ids}")
        
        # Get all organizations
        org_res = await db.execute(select(Organization))
        orgs = org_res.scalars().all()
        for o in orgs:
            print(f"Organization: {o.name}, ID: {o.id}")

if __name__ == "__main__":
    asyncio.run(debug_orgs())
