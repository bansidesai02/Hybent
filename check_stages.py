import asyncio
import sys
import os
from sqlalchemy import select

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'hireon-backend')))

from app.database import get_session_factory
from app.models.application import Application

async def check_stages():
    async with get_session_factory()() as db:
        res = (await db.execute(select(Application.stage, Application.organization_id))).all()
        for stage, org_id in res:
            print(f"Stage: {stage}, Org: {org_id}")

if __name__ == "__main__":
    asyncio.run(check_stages())
