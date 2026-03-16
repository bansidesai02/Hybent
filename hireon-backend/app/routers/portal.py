"""
Candidate portal endpoints — for candidates to self-register, view their own applications,
respond to offers, and view interview schedules.
"""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from app.dependencies import DB, CurrentUser
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.offer import Offer
from app.schemas.application import ApplicationOut
from app.schemas.interview import InterviewOut
from app.schemas.offer import OfferOut, OfferRespondRequest
from app.utils.permissions import UserRole, OfferStatus
from datetime import datetime, timezone

router = APIRouter(prefix="/v1/portal", tags=["portal"])


class PortalRegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    organization_slug: str


@router.post("/register", status_code=201)
async def portal_register(data: PortalRegisterRequest, db: DB):
    """Self-registration for candidates through the portal."""
    from app.models.organization import Organization
    from app.models.user import User
    from app.utils.security import hash_password, create_access_token, create_refresh_token
    from app.config import settings
    from datetime import timedelta
    from app.models.user import RefreshToken

    org = (await db.execute(select(Organization).where(Organization.slug == data.organization_slug))).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing_user = (await db.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        organization_id=org.id,
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.CANDIDATE,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    # Create candidate profile linked to user
    candidate = Candidate(
        organization_id=org.id,
        user_id=user.id,
        email=data.email,
        full_name=data.full_name,
    )
    db.add(candidate)

    access_token = create_access_token({"sub": str(user.id), "org": str(org.id), "role": user.role})
    refresh_tok = create_refresh_token()
    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_tok,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    ))

    return {"access_token": access_token, "refresh_token": refresh_tok, "token_type": "bearer"}


@router.get("/my-applications")
async def my_applications(current_user: CurrentUser, db: DB):
    """Candidate views their own applications."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        return []
    result = await db.execute(
        select(Application).where(Application.candidate_id == candidate.id)
    )
    return [ApplicationOut.model_validate(a).model_dump() for a in result.scalars().all()]


@router.get("/my-interviews")
async def my_interviews(current_user: CurrentUser, db: DB):
    """Candidate views their scheduled interviews."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        return []
    apps = (await db.execute(
        select(Application).where(Application.candidate_id == candidate.id)
    )).scalars().all()
    app_ids = [a.id for a in apps]
    if not app_ids:
        return []
    result = await db.execute(
        select(Interview).where(Interview.application_id.in_(app_ids))
    )
    return [InterviewOut.model_validate(i).model_dump() for i in result.scalars().all()]


@router.get("/my-offers")
async def my_offers(current_user: CurrentUser, db: DB):
    """Candidate views their offers."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        return []
    apps = (await db.execute(
        select(Application).where(Application.candidate_id == candidate.id)
    )).scalars().all()
    app_ids = [a.id for a in apps]
    if not app_ids:
        return []
    result = await db.execute(
        select(Offer).where(Offer.application_id.in_(app_ids))
    )
    return [OfferOut.model_validate(o).model_dump() for o in result.scalars().all()]


@router.post("/offers/{offer_id}/respond")
async def portal_respond_offer(offer_id: uuid.UUID, data: OfferRespondRequest, current_user: CurrentUser, db: DB):
    """Candidate accepts or declines their offer via portal."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")

    result = await db.execute(
        select(Offer).where(Offer.id == offer_id)
    )
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer.status = OfferStatus.ACCEPTED if data.accept else OfferStatus.DECLINED
    offer.responded_at = datetime.now(timezone.utc)
    if not data.accept:
        offer.decline_reason = data.decline_reason
    return OfferOut.model_validate(offer)


@router.get("/profile")
async def portal_profile(current_user: CurrentUser, db: DB):
    """Candidate views their own profile."""
    if current_user.role != UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidates only")
    from app.schemas.candidate import CandidateOut
    candidate = (await db.execute(
        select(Candidate).where(Candidate.user_id == current_user.id)
    )).scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return CandidateOut.model_validate(candidate)
