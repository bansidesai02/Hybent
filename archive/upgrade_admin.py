import asyncio
import sys
import os
from sqlalchemy import update

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hybent-hiring-backend')))

from app.database import get_session_factory
from app.models.user import User

async def upgrade_user():
    async with get_session_factory()() as db:
        await db.execute(
            update(User)
            .where(User.email == "dhrumithakkar30@gmail.com")
            .values(role="admin")
        )
        await db.commit()
        print("User upgraded to admin successfully.")

if __name__ == "__main__":
    asyncio.run(upgrade_user())
