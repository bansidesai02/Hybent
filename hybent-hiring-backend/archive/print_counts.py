import asyncio
from sqlalchemy import select, func
from app.core.database import get_session_factory
from app.models.candidate import Candidate
from app.models.user import User
from datetime import datetime, timezone, timedelta

async def check():
    session = get_session_factory()()
    async with session:
        # Total Candidates
        total = (await session.execute(select(func.count(Candidate.id)))).scalar()
        print('Total Candidates in DB:', total)
        
        # Candidates per organization
        org_counts = (await session.execute(
            select(Candidate.organization_id, func.count(Candidate.id))
            .group_by(Candidate.organization_id)
        )).all()
        print('\nCandidates per Organization:')
        for org_id, count in org_counts:
            print(f' - Org ID: {org_id} | Count: {count}')
            
        # Users in DB
        users = (await session.execute(
            select(User.id, User.full_name, User.email, User.organization_id, User.role)
        )).all()
        print('\nUsers in DB:')
        for u in users:
            print(f' - User: {u.full_name} | Email: {u.email} | Org ID: {u.organization_id} | Role: {u.role}')

        # Let's inspect date_trunc query for today and this week
        now = datetime.now(timezone.utc)
        print(f'\nCurrent UTC Time: {now}')
        
        # Count created today
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_count = (await session.execute(
            select(func.count(Candidate.id)).where(Candidate.created_at >= today_start)
        )).scalar()
        print(f'Candidates created today (>= {today_start}): {today_count}')

        # Count created this week (since Monday)
        week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = week_start - timedelta(days=week_start.weekday())
        week_count = (await session.execute(
            select(func.count(Candidate.id)).where(Candidate.created_at >= week_start)
        )).scalar()
        print(f'Candidates created this week (>= {week_start}): {week_count}')

if __name__ == '__main__':
    asyncio.run(check())
