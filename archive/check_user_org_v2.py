import asyncio
import sys
import os
from sqlalchemy import select

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.models.organization import Organization

async def check_user_org():
    async with get_session_factory()() as db:
        # Just check organizations first
        orgs = (await db.execute(select(Organization))).scalars().all()
        print(f"Total Organizations: {len(orgs)}")
        for o in orgs:
            print(f" - ID: {o.id}, Name: '{o.name}', Slug: '{o.slug}'")

        # Check user
        user_res = await db.execute(select(User).where(User.email == 'admin@brainerhub.com'))
        user = user_res.scalar_one_or_none()
        if user:
            print(f"User found: {user.full_name}, Org ID: {user.organization_id}")
            # Match org
            org = next((o for o in orgs if o.id == user.organization_id), None)
            if org:
                print(f"User's Org Name matches: {org.name}")
            else:
                print("User's Org ID NOT FOUND in organizations table!")
        else:
            print("User admin@brainerhub.com not found")

if __name__ == "__main__":
    asyncio.run(check_user_org())
