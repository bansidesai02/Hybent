"""Automated counterpart to app/routers/resumes.py::upload_and_create — turns
an inbound email attachment on a connected mailbox into a Candidate, without
a human recruiter driving the upload.

Every candidate created here lands in pipeline_stage="needs_review"
unconditionally (never auto-scored into an active pipeline) — broad mailbox
coverage (including recruiters' personal inboxes) means real false positives
are expected, and this is the safety gate that makes that acceptable. A
human always confirms before it's real.

created_by_id (and the activity log's actor) is the user who connected the
receiving mailbox (EmailAccount.connected_by_user_id) — they're the one who
opted this inbox into auto-registration, so the candidate shows up as added
by them rather than as an anonymous system action. If the connecting user's
account has since been removed (connected_by_user_id is SET NULL), there's
no one left to credit and it falls back to no actor. Either way, the actual
mechanism (which mailbox, which inbound email, the sender) is preserved in
Candidate.source_email_message_id/source_email_account_id and in the
AuditLog `details`, so it's still clear this wasn't a manual upload.
"""
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.email_account import EmailAccount
from app.models.email_message import EmailIngestionStatus, EmailMessage
from app.repositories.email_message import EmailMessageRepository
from app.services import supabase_storage_service
from app.services.activity_service import log_activity
from app.services.email_inbox_service import EmailInboxService
from app.services.email_providers import gmail_provider
from app.services.storage_service import save_resume_bytes
from app.utils.category import detect_category_from_skills, extract_core_category
from app.utils.job_matching import resolve_or_create_pool_job

logger = logging.getLogger(__name__)

SOURCE_EMAIL = "email"

# Signature/logo images are the main personal-inbox noise source and are
# never resumes in practice — excluded regardless of size. Everything else
# with a filename (PDF/DOC/DOCX/anything) counts, per the product decision
# to treat "any file" as a candidate resume attempt.
EXCLUDED_ATTACHMENT_MIME_TYPES = {"image/png", "image/gif"}

PARSEABLE_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

_EMPTY_PARSED_RESUME = {
    "full_name": None,
    "email": None,
    "phone": None,
    "location": None,
    "current_title": None,
    "current_company": None,
    "years_experience": None,
    "experience_years": None,
    "summary": None,
    "linkedin_url": None,
    "github_url": None,
    "portfolio_url": None,
    "skills": [],
    "education": [],
    "experience": [],
    "projects": [],
    "certifications": [],
    "languages": [],
}


def _select_attachment(attachments: list[dict]) -> dict | None:
    """First attachment that looks like a genuine resume attempt (has a
    filename, isn't a signature-image mimetype, is within the size limit).
    One email -> at most one candidate; extra attachments are ignored rather
    than creating ambiguous multiple candidates from a single message."""
    for attachment in attachments:
        if not attachment.get("filename"):
            continue
        if attachment.get("mime_type") in EXCLUDED_ATTACHMENT_MIME_TYPES:
            continue
        if attachment.get("size", 0) and attachment["size"] > settings.max_file_size_bytes:
            continue
        return attachment
    return None


class EmailApplicationIngestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EmailMessageRepository(db)
        self.inbox_service = EmailInboxService(db)

    async def process_account(self, account: EmailAccount) -> dict:
        """Process every not-yet-evaluated message on this account. Never
        lets one bad message abort the batch.

        Deliberately does its own metadata sync first rather than relying on
        the separate sync_all_inboxes beat task — that task (and the Inbox
        UI it feeds) only covers an org's default mailbox + each recruiter's
        personal one, but resume ingestion should cover every connected
        mailbox regardless of is_default (that flag is about which mailbox
        is the org's primary for admin/send purposes, not about whether a
        mailbox's mail should be scanned for applications)."""
        try:
            await self.inbox_service.sync_account(account)
        except Exception as e:
            logger.warning(f"Metadata sync failed for {account.email_address} during ingestion: {e}")

        counts = {"created": 0, "matched_existing": 0, "skipped": 0, "failed": 0}
        messages = await self.repo.get_unprocessed(account.id)
        for message in messages:
            try:
                outcome = await self.process_message(account, message)
                if outcome:
                    counts[outcome] = counts.get(outcome, 0) + 1
            except Exception as e:
                logger.warning(f"Email ingestion failed for message {message.id} on {account.email_address}: {e}")
        return counts

    async def process_message(self, account: EmailAccount, message: EmailMessage) -> str | None:
        claimed = await self.repo.claim_for_processing(message.id)
        if not claimed:
            return None
        await self.db.commit()

        try:
            full = gmail_provider.get_message_full(account, message.provider_message_id)
        except Exception as e:
            await self.repo.mark_result(message.id, EmailIngestionStatus.FAILED, error=str(e)[:2000])
            await self.db.commit()
            return "failed"

        attachments = full.get("attachments") or []
        message.has_attachments = bool(attachments)

        qualifying = _select_attachment(attachments)
        if not qualifying:
            await self.repo.mark_result(message.id, EmailIngestionStatus.SKIPPED_NOT_RESUME)
            await self.db.commit()
            return "skipped"

        from_name = full.get("from_name") or message.from_name
        from_address = full.get("from_address") or message.from_address

        try:
            file_bytes = gmail_provider.get_attachment_content(account, message.provider_message_id, qualifying)
        except Exception as e:
            await self.repo.mark_result(message.id, EmailIngestionStatus.FAILED, error=f"attachment fetch failed: {e}"[:2000])
            await self.db.commit()
            return "failed"

        try:
            candidate_id, status = await self._ingest_resume(
                account, message, qualifying["filename"], qualifying["mime_type"], file_bytes, from_name, from_address
            )
        except Exception as e:
            logger.exception(f"Email ingestion failed to create candidate for message {message.id}")
            await self.repo.mark_result(message.id, EmailIngestionStatus.FAILED, error=str(e)[:2000])
            await self.db.commit()
            return "failed"

        await self.repo.mark_result(message.id, status, candidate_id=candidate_id)
        await self.db.commit()
        return "created" if status == EmailIngestionStatus.CREATED else "matched_existing"

    async def _ingest_resume(
        self,
        account: EmailAccount,
        message: EmailMessage,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        from_name: str | None,
        from_address: str | None,
    ) -> tuple[uuid.UUID, str]:
        organization_id = account.organization_id

        # Cheap identity guess from headers first, so an obvious duplicate
        # sender can skip the expensive AI parse below entirely.
        header_email = from_address
        if header_email:
            existing = await self._find_existing_candidate(organization_id, header_email)
            if existing:
                return await self._link_duplicate(message, existing, account, from_address, from_name)

        parsed: dict
        if mime_type in PARSEABLE_MIME_TYPES:
            try:
                from app.services.ai.resume_parser import parse_resume
                parsed = await parse_resume(
                    file_bytes, mime_type, filename,
                    background_tasks=None, user_id=None, organization_id=organization_id,
                )
            except Exception as e:
                logger.info(f"Resume parse failed for message {message.id}, falling back to header metadata: {e}")
                parsed = dict(_EMPTY_PARSED_RESUME)
        else:
            parsed = dict(_EMPTY_PARSED_RESUME)

        full_name = parsed.get("full_name") or from_name or "Unknown Candidate"
        email = parsed.get("email") or from_address
        if not email:
            clean_name = re.sub(r"[^a-zA-Z0-9]", "", full_name.lower()) or "applicant"
            email = f"{clean_name}.{uuid.uuid4().hex[:6]}@hybent.temp"

        existing = await self._find_existing_candidate(organization_id, email)
        if existing:
            return await self._link_duplicate(message, existing, account, from_address, from_name)

        candidate_skills_list = parsed.get("skills") or []
        parsed_category = detect_category_from_skills(candidate_skills_list) or extract_core_category(
            parsed.get("current_title") or ""
        )
        job = await resolve_or_create_pool_job(
            self.db, organization_id, title_hint=parsed.get("current_title"), category_hint=parsed_category
        )

        score: float | None = None
        breakdown: dict | None = None
        is_real_job = job and job.status != "pool"
        if is_real_job:
            from app.services.ai.match_scorer import evaluate_candidate_match
            score, breakdown = await evaluate_candidate_match(
                candidate_data=parsed,
                candidate_skills=candidate_skills_list,
                years_experience=parsed.get("years_experience"),
                job=job,
                background_tasks=None,
                user_id=None,
                organization_id=organization_id,
            )

        candidate = Candidate(
            organization_id=organization_id,
            created_by_id=account.connected_by_user_id,
            source=SOURCE_EMAIL,
            source_email_message_id=message.id,
            source_email_account_id=account.id,
            email=email,
            full_name=full_name,
            pipeline_stage="needs_review",  # unconditional — see module docstring
            applied_job_title=job.title if job else None,
            skills=candidate_skills_list[:30],
            years_experience=parsed.get("years_experience"),
            experience_years=parsed.get("experience_years"),
            current_title=parsed.get("current_title"),
            current_company=parsed.get("current_company"),
            summary=parsed.get("summary"),
            phone=parsed.get("phone"),
            location=parsed.get("location"),
            linkedin_url=parsed.get("linkedin_url"),
            github_url=parsed.get("github_url"),
            portfolio_url=parsed.get("portfolio_url"),
            match_score=score,
            score_breakdown=breakdown,
            parsed_data=parsed,
        )
        self.db.add(candidate)
        await self.db.flush()

        if settings.supabase_url and settings.supabase_service_role_key:
            try:
                storage_path = await supabase_storage_service.upload_resume(
                    file_content=file_bytes,
                    organization_id=str(organization_id),
                    candidate_id=str(candidate.id),
                    original_filename=filename,
                    content_type=mime_type,
                )
                candidate.resume_storage_path = storage_path
                candidate.resume_filename = filename
            except Exception as e:
                logger.warning(f"Supabase resume upload failed ({e}), falling back to local/Cloudinary storage.")
                url, original_name = await save_resume_bytes(file_bytes, filename, mime_type, str(organization_id))
                candidate.resume_url = url
                candidate.resume_filename = original_name
        else:
            url, original_name = await save_resume_bytes(file_bytes, filename, mime_type, str(organization_id))
            candidate.resume_url = url
            candidate.resume_filename = original_name

        await log_activity(
            self.db,
            organization_id=organization_id,
            user_id=account.connected_by_user_id,
            action="CREATE",
            resource_type="candidate",
            resource_id=str(candidate.id),
            details={
                "name": candidate.full_name,
                "source": SOURCE_EMAIL,
                "email_account_id": str(account.id),
                "email_account_address": account.email_address,
                "email_message_id": str(message.id),
                "provider_message_id": message.provider_message_id,
                "from_address": from_address,
                "from_name": from_name,
                "subject": message.subject,
            },
        )

        return candidate.id, EmailIngestionStatus.CREATED

    async def _find_existing_candidate(self, organization_id: uuid.UUID, email: str) -> Candidate | None:
        result = await self.db.execute(
            select(Candidate).where(Candidate.email == email, Candidate.organization_id == organization_id)
        )
        return result.scalar_one_or_none()

    async def _link_duplicate(
        self,
        message: EmailMessage,
        existing: Candidate,
        account: EmailAccount,
        from_address: str | None,
        from_name: str | None,
    ) -> tuple[uuid.UUID, str]:
        await log_activity(
            self.db,
            organization_id=account.organization_id,
            user_id=account.connected_by_user_id,
            action="EMAIL_DUPLICATE_SKIPPED",
            resource_type="candidate",
            resource_id=str(existing.id),
            details={
                "email_account_id": str(account.id),
                "email_account_address": account.email_address,
                "email_message_id": str(message.id),
                "from_address": from_address,
                "from_name": from_name,
            },
        )
        return existing.id, EmailIngestionStatus.MATCHED_EXISTING
