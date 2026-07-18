import asyncio
from sqlalchemy import text
from app.core.database import get_session_factory

async def check():
    session = get_session_factory()()
    async with session:
        # Get count per day
        sql_days = """
            SELECT DATE_TRUNC('day', created_at) AS day, COUNT(id) AS count
            FROM candidates
            GROUP BY DATE_TRUNC('day', created_at)
            ORDER BY day DESC
        """
        days = (await session.execute(text(sql_days))).all()
        print('Candidates Count per Day (created_at):')
        for row in days:
            print(f' - Day: {row.day} | Count: {row.count}')

        # Get count per week
        sql_weeks = """
            SELECT DATE_TRUNC('week', created_at) AS week, COUNT(id) AS count
            FROM candidates
            GROUP BY DATE_TRUNC('week', created_at)
            ORDER BY week DESC
        """
        weeks = (await session.execute(text(sql_weeks))).all()
        print('\nCandidates Count per Week (created_at):')
        for row in weeks:
            print(f' - Week starting: {row.week} | Count: {row.count}')

if __name__ == '__main__':
    asyncio.run(check())
