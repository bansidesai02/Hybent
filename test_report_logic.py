import asyncio
import sys
import os
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from app.database import get_session_factory
from app.models.user import User
from app.services.report_service import get_report_summary

async def test_summary():
    async with get_session_factory()() as db:
        # Get the admin user
        user_res = await db.execute(select(User).where(User.email == "dhrumithakkar30@gmail.com"))
        user = user_res.scalar_one_or_none()
        
        if not user:
            print("User not found")
            return
            
        print(f"Testing for User: {user.email}, Role: {user.role}, Org ID: {user.organization_id}")
        
        # Manually set is_admin based on the same logic as the router
        is_admin = user.role == "admin"
        print(f"is_admin check: {is_admin}")
        
        summary = await get_report_summary(user.organization_id, user.id, is_admin, db)
        print(f"Summary result: {summary}")

if __name__ == "__main__":
    asyncio.run(test_summary())
