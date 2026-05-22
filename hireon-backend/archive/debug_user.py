import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import engine, AsyncSessionLocal
from app.models.user import User
from app.models.organization import Organization

async def check_user():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User)
            .options(selectinload(User.organization))
            .where(User.email == "admin@brainerhub.com")
        )
        user = result.scalar_one_or_none()
        if user:
            print(f"User found: {user.full_name}")
            print(f"Organization ID: {user.organization_id}")
            if user.organization:
                print(f"Organization Name: {user.organization.name}")
            else:
                print("Organization NOT loaded.")
                
            # Re-fetch org explicitly
            org_result = await db.execute(select(Organization).where(Organization.id == user.organization_id))
            org = org_result.scalar_one_or_none()
            if org:
                print(f"Actual Org Name from DB: {org.name}")
        else:
            print("User NOT found.")

if __name__ == "__main__":
    asyncio.run(check_user())
