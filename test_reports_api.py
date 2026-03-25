import asyncio
import uuid
import sys
import os

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from sqlalchemy import select
from app.database import get_session_factory
from app.models.user import User
from app.models.application import Application
from app.services import report_service
from app.utils.permissions import UserRole

async def test_reports():
    async with get_session_factory()() as db:
        # Get an admin user
        admin_res = await db.execute(select(User).where(User.role == UserRole.ADMIN).limit(1))
        admin = admin_res.scalar_one_or_none()
        
        if not admin:
            print("No admin user found for testing")
            return

        print(f"Testing for Admin: {admin.full_name}")
        summary = await report_service.get_report_summary(admin.organization_id, admin.id, True, db)
        print(f"Admin Summary: {summary}")
        
        csv_data = await report_service.export_report_csv(admin.organization_id, admin.id, True, db)
        print(f"Admin CSV Export Length: {len(csv_data)}")
        
        # Get a recruiter user
        recruiter_res = await db.execute(select(User).where(User.role == UserRole.RECRUITER).limit(1))
        recruiter = recruiter_res.scalar_one_or_none()
        
        if recruiter:
            print(f"Testing for Recruiter: {recruiter.full_name}")
            summary = await report_service.get_report_summary(recruiter.organization_id, recruiter.id, False, db)
            print(f"Recruiter Summary: {summary}")
            
            csv_data = await report_service.export_report_csv(recruiter.organization_id, recruiter.id, False, db)
            print(f"Recruiter CSV Export Length: {len(csv_data)}")
        else:
            print("No recruiter user found for testing")

if __name__ == "__main__":
    asyncio.run(test_reports())
