import asyncio
import sys
import os
from sqlalchemy import select, func

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.models.organization import Organization

async def check_user_org():
    async with get_session_factory()() as db:
        user_result = await db.execute(select(User).where(User.email == 'admin@example.com'))
        user = user_result.scalar_one_or_none()
        
        if not user:
            print("User admin@example.com not found")
            users = (await db.execute(select(User.email).limit(5))).scalars().all()
            print(f"Other users in DB: {users}")
            return
            
        print(f"User: {user.full_name} ({user.email})")
        print(f"Role: {user.role}")
        print(f"Org ID: {user.organization_id}")
        
        org_result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
        org = org_result.scalar_one_or_none()
        
        if org:
            print(f"Organization Name: '{org.name}'")
            print(f"Organization Slug: '{org.slug}'")
        else:
            print("Organization not found for this user!")

if __name__ == "__main__":
    asyncio.run(check_user_org())
