"""
Index resume RAG chunks (candidate_resume_chunks) for every existing
candidate that already has parsed_data but no chunks yet.

New uploads are indexed automatically as of this change (see
app.services.ai.resume_rag.index_candidate_resume_by_id /
stage_candidate_resume_chunks, wired into app/routers/resumes.py,
app/routers/portal.py, and app/services/email_ingestion_service.py) — this
script is a one-time catch-up for candidates who were parsed before that
wiring existed. Without it, every Copilot resume/skill-detail/interview-
question/similar-candidate question about a pre-existing candidate would
report "not enough information" until that candidate's resume happened to
be re-uploaded.

Safe to re-run: index_candidate_resume() deletes and re-inserts a
candidate's chunks, so running this twice just re-embeds, it never
duplicates rows.

Usage: docker exec hybent_hiring_backend python scripts/backfill_resume_rag.py
"""
import asyncio
import os
import sys

from sqlalchemy import select

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.append(project_root)

from app.models.candidate import Candidate
from app.core.database import AsyncSessionLocal
from app.services.ai.resume_rag import index_candidate_resume

BATCH_SIZE = 50


async def main():
    async with AsyncSessionLocal() as session:
        stmt = select(Candidate).where(Candidate.parsed_data.is_not(None), Candidate.is_deleted.is_(False))
        candidates = (await session.execute(stmt)).scalars().all()
        print(f"Found {len(candidates)} candidates with parsed_data to index.\n")

        indexed = 0
        empty = 0
        failed: list[str] = []

        for i, candidate in enumerate(candidates, start=1):
            try:
                count = await index_candidate_resume(session, candidate)
                if count > 0:
                    indexed += 1
                else:
                    empty += 1
                if i % BATCH_SIZE == 0:
                    print(f"  ...{i}/{len(candidates)} processed")
            except Exception as e:
                failed.append(f"{candidate.id} ({candidate.full_name} <{candidate.email}>): {e}")

        print(f"\nDone. {indexed} candidates indexed, {empty} had no chunkable content, {len(failed)} failed.")
        if failed:
            print("\nFailed:")
            for line in failed:
                print(f"  - {line}")


if __name__ == "__main__":
    asyncio.run(main())
