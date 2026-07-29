"""
Test script: hits GET /v1/users/me and prints the full response.
Run with: docker exec hybent_hiring_backend python /app/test_profile_api.py
"""
import asyncio
import sys
sys.path.append('/app')

from app.database import get_session_factory
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from app.models.user import User
from app.models.organization import Organization

async def main():
    async with get_session_factory()() as db:
        # Show what's in the organizations table
        res = await db.execute(text("SELECT id, name, logo_url FROM organizations"))
        print("=== ORGANIZATIONS in DB ===")
        orgs = res.all()
        for row in orgs:
            print(f"  org_id={row[0]}  name='{row[1]}'  logo={row[2]}")

        # Show users with their org_id
        res2 = await db.execute(text("SELECT id, email, role, organization_id FROM users"))
        print("\n=== USERS in DB ===")
        users = res2.all()
        for row in users:
            print(f"  user_id={row[0]}  email={row[1]}  role={row[2]}  org_id={row[3]}")

        # Test the same query as get_my_profile: user + joinedload organization
        for user_row in users:
            user_id = user_row[0]
            res3 = await db.execute(
                select(User)
                .options(joinedload(User.organization))
                .where(User.id == user_id)
            )
            user = res3.scalar_one_or_none()
            if user:
                has_org = user.organization is not None
                org_name = user.organization.name if has_org else "NO ORG LOADED!"
                print(f"\n  GET /me simulation for {user.email}:")
                print(f"    organization loaded? {has_org}")
                print(f"    organization_name = '{org_name}'")

asyncio.run(main())
