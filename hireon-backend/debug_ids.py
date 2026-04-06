import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.user import User
from app.models.organization import Organization

async def debug():
    async with async_session() as session:
        # Check all organizations
        orgs = (await session.execute(select(Organization))).scalars().all()
        print(f"Total Organizations: {len(orgs)}")
        for org in orgs:
            print(f"Org ID: {org.id}, Name: {org.name}")

        # Check all users
        users = (await session.execute(select(User))).scalars().all()
        print(f"Total Users: {len(users)}")
        for u in users:
            print(f"User: {u.email}, OrgID: {u.organization_id}, Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(debug())
