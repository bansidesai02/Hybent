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
        res = await db.execute(select(Organization).limit(1))
        org = res.scalar_one_or_none()
        if not org:
            org = Organization(name="Hybent", slug="hybent")
            db.add(org)
            await db.flush()

        user_res = await db.execute(select(User).where(User.email == "yashdesai494@gmail.com"))
        user = user_res.scalar_one_or_none()

        if not user:
            user = User(
                organization_id=org.id,
                email="yashdesai494@gmail.com",
                full_name="Yash Desai",
                hashed_password=hash_password("password123"),
                role=UserRole.ADMIN.value,
                provider="email",
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            print("Created user yashdesai494@gmail.com successfully.")
        else:
            user.is_active = True
            user.is_verified = True
            print("User yashdesai494@gmail.com already exists, updated active status.")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(main())
