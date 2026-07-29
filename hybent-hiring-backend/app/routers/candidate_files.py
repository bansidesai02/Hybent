"""
Secure on-demand file access for candidate resumes.

Security model:
- All buckets are private in Supabase Storage.
- No signed URLs are ever stored in the database.
- A fresh signed URL is generated on every request after authorization.
- Organization isolation is enforced on every endpoint.
- All access attempts are audit-logged.

Role access matrix:
  ADMIN     → any candidate in their organization
  RECRUITER → any candidate in their organization
  INTERVIEWER → any candidate in their organization
  CANDIDATE → only their own resume (via /v1/portal/profile/resume)
  SUPER_ADMIN → any candidate in any organization

Audio endpoints are reserved for a future implementation phase.
"""
import uuid
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.dependencies import DB, get_current_user
from app.models.candidate import Candidate
from app.models.user import User
from app.schemas.response import APIResponse
from app.services.activity_service import log_activity
from app.services import supabase_storage_service
from app.utils.permissions import UserRole
from app.core.config import settings

router = APIRouter(prefix="/v1/candidates", tags=["candidate-files"])
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Authorization helper
# ─────────────────────────────────────────────────────────────────────────────

async def _authorize_file_access(
    candidate_id: uuid.UUID,
    current_user: User,
    db,
) -> Candidate:
    """
    Validate that the current user is allowed to access files for this candidate.

    Rules:
    - SUPER_ADMIN: access any candidate.
    - ADMIN / RECRUITER / INTERVIEWER: candidate must belong to same organization.
    - CANDIDATE: not permitted via this endpoint (use /v1/portal/profile/resume).

    Returns the Candidate ORM object if authorized.
    Raises HTTP 403 or 404 if not.
    """
    if current_user.role == UserRole.CANDIDATE.value:
        logger.warning(
            "CANDIDATE role attempted to access candidate files via admin endpoint | "
            "user_id=%s candidate_id=%s",
            current_user.id,
            candidate_id,
        )
        raise HTTPException(
            status_code=403,
            detail="Candidates must use the portal endpoint to access their own files.",
        )

    # Build query — super admins bypass org filter
    query = select(Candidate).where(Candidate.id == candidate_id)
    if current_user.role != UserRole.SUPER_ADMIN.value:
        query = query.where(Candidate.organization_id == current_user.organization_id)

    result = await db.execute(query)
    candidate = result.scalar_one_or_none()

    if not candidate:
        logger.warning(
            "File access denied — candidate not found or cross-org attempt | "
            "user_id=%s user_org=%s candidate_id=%s",
            current_user.id,
            current_user.organization_id,
            candidate_id,
        )
        raise HTTPException(
            status_code=404,
            detail="Candidate not found.",
        )

    return candidate


# ─────────────────────────────────────────────────────────────────────────────
# Resume Access Endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{candidate_id}/resume")
async def get_candidate_resume_url(
    candidate_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: DB,
):
    """
    Generate a fresh, time-limited signed URL for a candidate's resume.

    On every call:
    1. Authenticates the user (JWT).
    2. Authorizes organization membership and role.
    3. Verifies the candidate has a resume in Supabase Storage.
    4. Generates a brand-new signed URL (never reused, never cached).
    5. Logs the access in the audit trail.
    6. Returns the signed URL.

    The URL expires after RESUME_SIGNED_URL_EXPIRY seconds (default: 1 hour).

    Role access: ADMIN, RECRUITER, INTERVIEWER (own org); SUPER_ADMIN (any org).
    """
    candidate = await _authorize_file_access(candidate_id, current_user, db)

    # Check if this candidate has a Supabase-stored resume
    if not candidate.resume_storage_path:
        # Provide a helpful error distinguishing "no resume" from "legacy URL"
        if candidate.resume_url:
            # Resume exists but is a legacy Cloudinary/local URL
            raise HTTPException(
                status_code=400,
                detail=(
                    "This candidate's resume was uploaded using the legacy storage system. "
                    "Please re-upload the resume to enable secure signed URL access."
                ),
            )
        raise HTTPException(
            status_code=404,
            detail="No resume has been uploaded for this candidate.",
        )

    # Generate a fresh signed URL (never stored, generated on every request)
    signed_url = await supabase_storage_service.get_signed_resume_url(
        storage_path=candidate.resume_storage_path,
        expiry_seconds=settings.resume_signed_url_expiry,
    )

    # Audit log every access for compliance and monitoring
    await log_activity(
        db,
        organization_id=current_user.organization_id,
        user_id=current_user.id,
        action="RESUME_VIEW",
        resource_type="candidate",
        resource_id=str(candidate_id),
        details={
            "candidate_name": candidate.full_name,
            "storage_path": candidate.resume_storage_path,
            "signed_url_expiry_seconds": settings.resume_signed_url_expiry,
        },
    )

    logger.info(
        "Resume signed URL generated | user_id=%s candidate_id=%s org=%s",
        current_user.id,
        candidate_id,
        current_user.organization_id,
    )

    return APIResponse.success(
        message="Resume URL generated successfully.",
        data={
            "url": signed_url,
            "expires_in": settings.resume_signed_url_expiry,
            "filename": candidate.resume_filename,
        },
    )

