import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User
from app.utils.permissions import UserRole
from app.utils.security import hash_password

async def main():
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        user_res = await db.execute(select(User).where(User.email == "admin@hybent.com"))
        user = user_res.scalar_one_or_none()

        new_password = "yashdesai123"
        hashed = hash_password(new_password)

        if not user:
            # Get or create default org
            res = await db.execute(select(Organization).limit(1))
            org = res.scalar_one_or_none()
            if not org:
                org = Organization(name="Hybent", slug="hybent")
                db.add(org)
                await db.flush()

            user = User(
                organization_id=org.id,
                email="admin@hybent.com",
                full_name="Admin User",
                hashed_password=hashed,
                role=UserRole.ADMIN.value,
                provider="email",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            print(f"Created admin@hybent.com with new password: {new_password}")
        else:
            user.hashed_password = hashed
            user.is_active = True
            user.is_verified = True
            print(f"Updated password for admin@hybent.com to: {new_password}")

        await db.commit()
        print("Password updated successfully in database.")

if __name__ == "__main__":
    asyncio.run(main())
