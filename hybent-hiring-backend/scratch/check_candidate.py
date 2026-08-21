import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.candidate import Candidate

async def main():
    async with SessionLocal() as db:
        res = await db.execute(select(Candidate).where(Candidate.email == 'yp192006@gmail.com'))
        candidate = res.scalar_one_or_none()
        if candidate:
            print("Name:", candidate.full_name)
            print("Years Exp:", candidate.years_experience)
            print("Exp Str:", candidate.experience_years)
            import json
            print("Parsed Data:", json.dumps(candidate.parsed_data, indent=2))
        else:
            print("Candidate not found")

if __name__ == "__main__":
    asyncio.run(main())
