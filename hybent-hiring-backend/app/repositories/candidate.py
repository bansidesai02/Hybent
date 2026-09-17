from typing import Sequence
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.candidate import Candidate
from app.repositories.base import BaseRepository

class CandidateRepository(BaseRepository[Candidate]):
    def __init__(self, db: AsyncSession):
        super().__init__(Candidate, db)

    async def get_by_email(self, email: str) -> Candidate | None:
        result = await self.db.execute(select(Candidate).where(Candidate.email == email))
        return result.scalar_one_or_none()

    async def get_by_organization(self, organization_id: str) -> Sequence[Candidate]:
        result = await self.db.execute(
            select(Candidate).where(Candidate.organization_id == organization_id)
        )
        return result.scalars().all()
