import asyncio
from sqlalchemy import select
from app.core.database import get_session_factory
from app.models.candidate import Candidate

async def check():
    session = get_session_factory()()
    async with session:
        c = (await session.execute(select(Candidate).where(Candidate.email == 'yashdesai494@gmail.com'))).scalar_one_or_none()
        if c:
            print('ID:', c.id)
            print('current_title:', c.current_title)
            print('applied_job_title:', c.applied_job_title)
            print('current_salary:', c.current_salary)
            print('current_ctc:', c.current_ctc)
            print('expected_salary:', c.expected_salary)
            print('expected_ctc:', c.expected_ctc)
            print('notice_period_days:', c.notice_period_days)
            print('availability_status:', c.availability_status)
        else:
            print('Not found')

if __name__ == '__main__':
    asyncio.run(check())
