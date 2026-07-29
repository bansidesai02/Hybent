import asyncio
import os
import sys

# Add the current directory to sys.path so 'app' can be imported
sys.path.append(os.getcwd())

from app.core.database import engine, AsyncSessionLocal
from app.models.user import User
from app.models.organization import Organization
from app.utils.security import hash_password
from app.utils.permissions import UserRole
from sqlalchemy import select

async def seed():
    print("Starting database seeding...")
    async with AsyncSessionLocal() as db:
        # Create Org
        org_name = "BrainerHub"
        org_slug = "brainerhub"
        
        result = await db.execute(select(Organization).where(Organization.slug == org_slug))
        org = result.scalar_one_or_none()
        
        if not org:
            org = Organization(name=org_name, slug=org_slug)
            db.add(org)
            await db.flush()
            print(f"✅ Organization '{org_name}' created.")
        else:
            print(f"ℹ️ Organization '{org_name}' already exists.")
        
        # Create Admin
        email = "admin@brainerhub.com"
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                organization_id=org.id,
                email=email,
                hashed_password=hash_password("password123"),
                full_name="Admin User",
                role=UserRole.ADMIN,
                is_verified=True,
                is_active=True
            )
            db.add(user)
            print(f"✅ Admin '{email}' created with password: password123")
        else:
            print(f"ℹ️ Admin '{email}' already exists.")
        
        await db.commit()
    print("Database seeding completed.")

if __name__ == "__main__":
    asyncio.run(seed())
