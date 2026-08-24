import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User
from app.utils.permissions import UserRole
from app.utils.security import hash_password

async def main():
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with Session() as db:
        # Check if organization exists
        org_result = await db.execute(select(Organization).limit(1))
        org = org_result.scalar_one_or_none()
        if not org:
            # Create a default org
            org = Organization(
                name="Hybent Test",
                slug="hybent-test"
            )
            db.add(org)
            await db.flush()
            print(f"Created organization: {org.name}")
        
        # Check if user already exists
        email = "superadmin_test@hybent.com"
        user_result = await db.execute(select(User).where(User.email == email))
        user = user_result.scalar_one_or_none()
        if user:
            print(f"User {email} already exists. Updating role to super_admin.")
            user.role = UserRole.SUPER_ADMIN.value
            user.is_active = True
            user.is_verified = True
            user.hashed_password = hash_password("password123")
        else:
            user = User(
                organization_id=org.id,
                email=email,
                full_name="Super Admin Test",
                hashed_password=hash_password("password123"),
                role=UserRole.SUPER_ADMIN.value,
                is_active=True,
                is_verified=True
            )
            db.add(user)
            print(f"Created user {email} as super_admin.")
        
        await db.commit()
        print("Successfully seeded super admin!")

if __name__ == "__main__":
    asyncio.run(main())
