import asyncio
from sqlalchemy import text
from app.database import get_session_factory
from datetime import datetime, timezone

async def check():
    session = get_session_factory()()
    async with session:
        oid = "358f87f6-5b6d-46f4-bb33-ed4ff6231f42"
        sql = """
            SELECT
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid) AS total_candidates,
                (SELECT COUNT(*) FROM jobs WHERE organization_id = :oid AND status = 'active') AS active_jobs,
                (SELECT COUNT(*) FROM jobs WHERE organization_id = :oid) AS total_jobs,
                (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid AND status = 'scheduled') AS upcoming_interviews,
                (SELECT COUNT(*) FROM interviews WHERE organization_id = :oid) AS total_interviews,
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                    AND pipeline_stage IN ('offered', 'hired', 'hired_joined')) AS offers_extended,
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                    AND pipeline_stage IN ('hired', 'hired_joined')) AS total_hired,
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                    AND pipeline_stage IN ('rejected','pre_screening_rejected',
                    'technical_round_rejected','technical_round_back_out',
                    'practical_round_rejected','practical_round_back_out',
                    'techno_functional_rejected','management_round_rejected',
                    'hr_round_rejected','offered_back_out','offer_withdrawn')) AS total_rejected,
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                    AND created_at >= DATE_TRUNC('week', NOW() AT TIME ZONE 'UTC')) AS added_this_week,
                (SELECT COUNT(*) FROM candidates WHERE organization_id = :oid
                    AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC')) AS added_today
        """
        res = await session.execute(text(sql), {"oid": oid})
        row = dict(res.fetchone()._mapping)
        print("SQL query results:")
        for k, v in row.items():
            print(f" - {k}: {v}")

if __name__ == '__main__':
    asyncio.run(check())
