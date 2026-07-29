import asyncio
import logging
import uuid
import traceback

from sqlalchemy import select

from app.services.copilot_service import run_copilot_chat
from app.core.database import AsyncSessionLocal
from app.models.organization import Organization
from app.models.user import User

logging.basicConfig(level=logging.INFO)

async def get_or_create_org_user(db):
    org_res = await db.execute(select(Organization).limit(1))
    org = org_res.scalar_one_or_none()
    if not org:
        raise Exception("No organization found in DB.")
        
    user_res = await db.execute(select(User).where(User.organization_id == org.id).limit(1))
    user = user_res.scalar_one_or_none()
    if not user:
        raise Exception("No user found in DB.")
        
    return org, user

async def test_copilot():
    async with AsyncSessionLocal() as db:
        org, user = await get_or_create_org_user(db)
        org_id = org.id
        user_id = user.id
        print(f"Using Organization ID: {org_id}")
        print(f"Using User ID: {user_id}")
        
        # Test 1: Ask for pipeline summary
        print("\n--- TEST 1: Pipeline Summary ---")
        try:
            result = await run_copilot_chat(
                user_message="What is the current pipeline summary?",
                history=[],
                organization_id=org_id,
                db=db,
                user_id=user_id,
            )
            print(f"Result: {result}")
        except Exception as e:
            traceback.print_exc()

        # Test 2: Search for Python candidate
        print("\n--- TEST 2: Search Python Candidate ---")
        try:
            result = await run_copilot_chat(
                user_message="Find any python candidate for me",
                history=[],
                organization_id=org_id,
                db=db,
                user_id=user_id,
            )
            print(f"Result: {result}")
        except Exception as e:
            traceback.print_exc()

        # Test 3: Schedule with page context
        print("\n--- TEST 3: Schedule with page context candidate name ---")
        try:
            result = await run_copilot_chat(
                user_message="Schedule a technical round tomorrow at 2 pm",
                history=[],
                organization_id=org_id,
                db=db,
                user_id=user_id,
                page_context={"candidate_name": "Test Candidate"}
            )
            print(f"Result: {result}")
        except Exception as e:
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_copilot())
