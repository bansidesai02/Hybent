"""
Recompute years_experience/experience_years for existing candidates using the
fixed calculate_years_from_experience() — no LLM re-call needed, since the raw
parsed experience entries are already stored in candidate.parsed_data.

Run after the resume_parser.py fix (removal of the "single bare year -> ~1
month" guess) that produced misleading values like years_experience=0.1 for
candidates whose resume had an ambiguous, unresolvable duration entry.

Candidates with no parsed_data (e.g. ones who went through the candidate
self-service portal upload before that endpoint started persisting it) can't
be recomputed from stored data — they're reported, not guessed at.

Usage: docker exec hybent_hiring_backend python scripts/backfill_experience.py
"""
import asyncio
import os
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.append(project_root)

from app.models.candidate import Candidate
from app.core.database import AsyncSessionLocal
from app.services.ai.resume_parser import calculate_years_from_experience

BATCH_SIZE = 200


async def backfill_batch(session: AsyncSession, candidates: list[Candidate]) -> tuple[int, int, list[str]]:
    updated = 0
    unchanged = 0
    unrecoverable: list[str] = []

    for candidate in candidates:
        experience_list = (candidate.parsed_data or {}).get("experience")
        if not experience_list:
            unrecoverable.append(f"{candidate.id} ({candidate.full_name} <{candidate.email}>)")
            continue

        years, text = calculate_years_from_experience(experience_list)
        if years != candidate.years_experience or text != candidate.experience_years:
            print(
                f"  {candidate.full_name} <{candidate.email}>: "
                f"{candidate.years_experience!r}/{candidate.experience_years!r} -> {years!r}/{text!r}"
            )
            candidate.years_experience = years
            candidate.experience_years = text
            updated += 1
        else:
            unchanged += 1

    await session.commit()
    return updated, unchanged, unrecoverable


async def main():
    async with AsyncSessionLocal() as session:
        total_stmt = select(Candidate).where(Candidate.years_experience.is_not(None))
        total = (await session.execute(total_stmt)).scalars().all()
        print(f"Found {len(total)} candidates with an experience value to check.\n")

        offset = 0
        total_updated = 0
        total_unchanged = 0
        all_unrecoverable: list[str] = []

        while True:
            stmt = (
                select(Candidate)
                .where(Candidate.years_experience.is_not(None))
                .limit(BATCH_SIZE)
                .offset(offset)
            )
            batch = (await session.execute(stmt)).scalars().all()
            if not batch:
                break
            updated, unchanged, unrecoverable = await backfill_batch(session, batch)
            total_updated += updated
            total_unchanged += unchanged
            all_unrecoverable.extend(unrecoverable)
            offset += BATCH_SIZE

        print(f"\nDone. {total_updated} corrected, {total_unchanged} already correct, "
              f"{len(all_unrecoverable)} could not be recomputed (no stored parsed_data).")
        if all_unrecoverable:
            print("\nCandidates with no parsed_data to recompute from (re-upload their resume to fix, "
                  "or clear the value manually):")
            for line in all_unrecoverable:
                print(f"  - {line}")


if __name__ == "__main__":
    asyncio.run(main())
