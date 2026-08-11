import asyncio
import os
import sys
import logging
from typing import List

import httpx
import aiofiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.append(project_root)

from app.models.candidate import Candidate
from app.core.database import AsyncSessionLocal
from app.services import supabase_storage_service

logger = logging.getLogger(__name__)
BATCH_SIZE = 100

async def fetch_file(url: str) -> bytes:
    """Download the file from the given URL and return its binary content."""
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content

async def migrate_batch(session: AsyncSession, candidates: List[Candidate]):
    for candidate in candidates:
        legacy_url = candidate.resume_url
        if not legacy_url:
            continue
        try:
            print(f"Fetching legacy resume for candidate {candidate.id} from {legacy_url}...")
            file_bytes = await fetch_file(legacy_url)
            filename = os.path.basename(legacy_url.split("?")[0]) or f"resume_{candidate.id}.pdf"
            if not filename.endswith((".pdf", ".doc", ".docx")):
                filename += ".pdf"

            storage_path = await supabase_storage_service.upload_resume(
                file_content=file_bytes,
                organization_id=str(candidate.organization_id),
                candidate_id=str(candidate.id),
                original_filename=filename,
                content_type="application/pdf",
            )
            candidate.resume_storage_path = storage_path
            candidate.resume_url = None
            session.add(candidate)
            print(f"Successfully migrated candidate {candidate.id} -> {storage_path}")
        except Exception as e:
            print(f"Error migrating candidate {candidate.id}: {e}")
            err_path = os.path.join(os.path.dirname(__file__), "migration_errors.log")
            async with aiofiles.open(err_path, "a") as err_file:
                await err_file.write(f"Failed candidate {candidate.id}: {e}\n")
    await session.commit()

async def main():
    async with AsyncSessionLocal() as session:
        # Count total candidates needing migration
        total_stmt = select(Candidate).where(Candidate.resume_url.is_not(None))
        result = await session.execute(total_stmt)
        total = result.scalars().all()
        print(f"Found {len(total)} candidates with legacy resumes.")

        offset = 0
        while True:
            stmt = (select(Candidate)
                    .where(Candidate.resume_url.is_not(None))
                    .limit(BATCH_SIZE)
                    .offset(offset))
            batch_res = await session.execute(stmt)
            batch = batch_res.scalars().all()
            if not batch:
                break
            await migrate_batch(session, batch)
            offset += BATCH_SIZE
            print(f"Completed batch up to offset {offset}.")

if __name__ == "__main__":
    asyncio.run(main())

