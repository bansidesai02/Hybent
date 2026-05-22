import asyncio
import sys
sys.path.append('/app')

from app.database import get_session_factory
from sqlalchemy import text

async def main():
    async with get_session_factory()() as db:
        # List all users
        res = await db.execute(text("SELECT id, email, role, organization_id FROM users"))
        print("=== USERS ===")
        for row in res.all():
            print(f"  id={row[0]}  email={row[1]}  role={row[2]}  org_id={row[3]}")
        
        # List all organizations
        res2 = await db.execute(text("SELECT id, name FROM organizations"))
        print("=== ORGANIZATIONS ===")
        for row in res2.all():
            print(f"  id={row[0]}  name={row[1]}")
        
        # Try to update org name for first org
        res3 = await db.execute(text("SELECT id FROM organizations LIMIT 1"))
        first_org = res3.scalar_one_or_none()
        if first_org:
            print(f"\nAttempting to update org {first_org} name to 'TestOrg_Debug'...")
            await db.execute(
                text("UPDATE organizations SET name='TestOrg_Debug' WHERE id=:id"),
                {"id": first_org}
            )
            await db.commit()
            
            res4 = await db.execute(text("SELECT id, name FROM organizations WHERE id=:id"), {"id": first_org})
            row = res4.one()
            print(f"After update: id={row[0]}  name={row[1]}")
        else:
            print("No organizations found!")

asyncio.run(main())
