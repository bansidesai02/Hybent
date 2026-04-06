"""Test what GET /v1/users/me actually returns by calling the live API."""
import asyncio
import sys
sys.path.append('/app')

from app.database import get_session_factory
from sqlalchemy import text, select
from sqlalchemy.orm import joinedload
from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserOut

async def main():
    async with get_session_factory()() as db:
        # Fetch all users with organizations
        res = await db.execute(
            select(User).options(joinedload(User.organization))
        )
        users = res.scalars().all()
        
        print(f"=== Testing _user_out_with_org for {len(users)} users ===")
        for user in users:
            print(f"\nUser: {user.email} (role={user.role})")
            print(f"  organization_id: {user.organization_id}")
            print(f"  organization loaded: {user.organization is not None}")
            if user.organization:
                print(f"  org.name: {user.organization.name}")
            
            # Simulate the exact code from _user_out_with_org
            data = UserOut.model_validate(user)
            print(f"  BEFORE model_copy: organization_name = {data.organization_name!r}")
            
            if hasattr(user, 'organization') and user.organization:
                data2 = data.model_copy(update={
                    'organization_name': user.organization.name,
                    'organization_logo_url': user.organization.logo_url,
                })
                print(f"  AFTER model_copy: organization_name = {data2.organization_name!r}")
                print(f"  JSON output: {data2.model_dump_json()}")

asyncio.run(main())
