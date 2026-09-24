"""Automated counterpart to app/routers/resumes.py::upload_and_create — turns
each inbound resume attachment on a connected mailbox into a Candidate,
without a human recruiter driving the upload. One email can carry several
resumes (a referrer or agency sending a batch) — each becomes its own
candidate.

A transient parse failure (AI rate limit, credits exhausted, provider down)
does not produce a hollow candidate: the message goes to RETRY_PENDING and is
picked up again by later runs, up to MAX_INGESTION_ATTEMPTS. Only the final
attempt falls back to a candidate built from the email headers, so the
application is never silently lost.

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
import asyncio
import logging
import re
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.candidate import Candidate
from app.models.email_account import EmailAccount
from app.models.email_message import MAX_INGESTION_ATTEMPTS, EmailIngestionStatus, EmailMessage
from app.repositories.email_message import EmailMessageRepository
from app.services import supabase_storage_service
from app.services.activity_service import log_activity
from app.services.email_inbox_service import EmailInboxService
from app.services.email_providers import gmail_provider
from app.services.storage_service import save_resume_bytes
from app.services.ai.resume_parser import apply_experience_fields
from app.services.ai.resume_rag import stage_candidate_resume_chunks
from app.utils.category import detect_category_from_skills, extract_core_category
from app.utils.exceptions import InsufficientCreditsException
from app.utils.job_matching import resolve_or_create_pool_job
from app.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

SOURCE_EMAIL = "email"

PARSEABLE_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

# Some mail clients send PDFs/DOCs with a generic mime type (e.g.
# application/octet-stream) — fall back to the filename extension so those
# aren't dropped just because the mime type is uninformative.
RESUME_FILE_EXTENSIONS = (".pdf", ".doc", ".docx")

# Bounds AI spend on a single message — no genuine application carries more.
MAX_RESUMES_PER_EMAIL = 10

# Spacing between AI parses within a batch, so ingestion doesn't trip the
# provider's rate limit on its own.
PARSE_SPACING_SECONDS = 0.5


class NotAResume(Exception):
    """Raised internally to signal a qualifying attachment was positively
    identified as not a resume (by app.services.ai.resume_parser's content
    validation) — distinct from a transient parsing/infra failure, so the
    message can be marked SKIPPED_NOT_RESUME instead of FAILED, and no
    placeholder candidate gets created from it."""


class TransientParseError(Exception):
    """The AI parse failed for a reason that may clear on its own (rate
    limit, provider outage). The message is retried on a later run rather
    than turned into a candidate with no parsed data."""


class CreditsExhausted(TransientParseError):
    """The organisation has no AI credits left. Retried like any transient
    failure, but also stops the rest of the account's batch — every other
    message would fail the same way and burn an attempt for nothing."""


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


def _is_resume_document_type(attachment: dict) -> bool:
    """A real resume document type (PDF/DOC/DOCX) by mime type or, failing
    that, filename extension. Signature images, zips, spreadsheets, and
    every other attachment type showing up in personal/shared inboxes are
    never resumes in practice, so they're excluded outright here rather than
    accepted sight-unseen and left for a human to reject later."""
    if attachment.get("mime_type") in PARSEABLE_MIME_TYPES:
        return True
    filename = (attachment.get("filename") or "").lower()
    return filename.endswith(RESUME_FILE_EXTENSIONS)


def _select_attachments(attachments: list[dict]) -> list[dict]:
    """Every attachment that looks like a genuine resume attempt (has a
    filename, is a resume-shaped document type, is within the size limit),
    capped at MAX_RESUMES_PER_EMAIL.

    This is a cheap type/size filter only — whether each document's *content*
    is actually a resume (vs. an invoice, ID, certificate, etc.) is checked
    later in _ingest_resume via app.services.ai.resume_parser."""
    selected = []
    for attachment in attachments:
        if not attachment.get("filename"):
            continue
        if not _is_resume_document_type(attachment):
            continue
        if attachment.get("size", 0) and attachment["size"] > settings.max_file_size_bytes:
            continue
        selected.append(attachment)
        if len(selected) >= MAX_RESUMES_PER_EMAIL:
            break
    return selected


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
        for i, message in enumerate(messages):
            if i:
                await asyncio.sleep(PARSE_SPACING_SECONDS)
            try:
                outcome = await self.process_message(account, message)
                if outcome:
                    counts[outcome] = counts.get(outcome, 0) + 1
            except CreditsExhausted:
                counts["retry"] = counts.get("retry", 0) + 1
                logger.warning(f"AI credits exhausted for {account.email_address}; deferring the rest of this batch")
                break
            except Exception as e:
                logger.warning(f"Email ingestion failed for message {message.id} on {account.email_address}: {e}")
        return counts

    async def process_message(self, account: EmailAccount, message: EmailMessage) -> str | None:
        """Ingest every resume attached to one message.

        Returns the message-level outcome ("created", "matched_existing",
        "skipped", "retry" or "failed"). Raises CreditsExhausted after
        recording the retry, so process_account can stop its batch."""
        claimed = await self.repo.claim_for_processing(message.id)
        if not claimed:
            return None
        await self.db.commit()
        # The claim bumped ingestion_attempts in SQL; read it back.
        await self.db.refresh(message)
        final_attempt = message.ingestion_attempts >= MAX_INGESTION_ATTEMPTS

        try:
            full = gmail_provider.get_message_full(account, message.provider_message_id)
        except Exception as e:
            # A Gmail/network failure says nothing about the email itself —
            # retry it like a transient parse failure until attempts run out.
            status = EmailIngestionStatus.FAILED if final_attempt else EmailIngestionStatus.RETRY_PENDING
            await self.repo.mark_result(message.id, status, error=f"message fetch failed: {e}"[:2000])
            await self.db.commit()
            return "failed" if final_attempt else "retry"

        attachments = full.get("attachments") or []
        message.has_attachments = bool(attachments)

        qualifying = _select_attachments(attachments)
        if not qualifying:
            await self.repo.mark_result(message.id, EmailIngestionStatus.SKIPPED_NOT_RESUME)
            await self.db.commit()
            return "skipped"

        from_name = full.get("from_name") or message.from_name
        from_address = full.get("from_address") or message.from_address
        # With several resumes attached the sender is a referrer or agency,
        # not the candidate — their name and address must not stand in for
        # any one applicant's.
        multi = len(qualifying) > 1

        created: list[uuid.UUID] = []
        matched: list[uuid.UUID] = []
        errors: list[str] = []
        retry = False
        credits_exhausted = False

        for attachment in qualifying:
            filename = attachment["filename"]

            # Already turned into a candidate by an earlier attempt of this
            # same message — don't re-parse or spend credits on it again.
            done = await self._candidate_from_earlier_attempt(message, filename)
            if done:
                created.append(done.id)
                continue

            if credits_exhausted:
                retry = True
                continue

            try:
                file_bytes = gmail_provider.get_attachment_content(account, message.provider_message_id, attachment)
            except Exception as e:
                errors.append(f"{filename}: attachment fetch failed: {e}")
                if not final_attempt:
                    retry = True
                continue

            # A savepoint per attachment: a failure discards only what this
            # attachment staged. A full rollback would also expire `account`
            # and `message`, which the rest of the loop still reads.
            try:
                async with self.db.begin_nested():
                    candidate_id, status = await self._ingest_resume(
                        account, message, filename, attachment["mime_type"], file_bytes,
                        from_name, from_address, multi=multi, final_attempt=final_attempt,
                    )
            except NotAResume:
                continue
            except TransientParseError as e:
                retry = True
                errors.append(f"{filename}: {e}")
                if isinstance(e, CreditsExhausted):
                    credits_exhausted = True
                continue
            except Exception as e:
                logger.exception(f"Email ingestion failed to create candidate from {filename} on message {message.id}")
                errors.append(f"{filename}: {e}")
                continue

            # Commit per attachment, so a later failure can't roll back a
            # candidate that was already created successfully.
            await self.db.commit()
            if status == EmailIngestionStatus.CREATED:
                created.append(candidate_id)
                await self._announce_candidate(account, candidate_id)
            elif status == EmailIngestionStatus.MATCHED_EXISTING:
                matched.append(candidate_id)

        error = "\n".join(errors)[:2000] or None
        first_candidate = (created or matched or [None])[0]

        if retry:
            await self.repo.mark_result(
                message.id, EmailIngestionStatus.RETRY_PENDING, candidate_id=first_candidate, error=error
            )
            await self.db.commit()
            if credits_exhausted:
                raise CreditsExhausted(error or "AI credits exhausted")
            return "retry"

        if created:
            status, outcome = EmailIngestionStatus.CREATED, "created"
        elif matched:
            status, outcome = EmailIngestionStatus.MATCHED_EXISTING, "matched_existing"
        elif errors:
            status, outcome = EmailIngestionStatus.FAILED, "failed"
        else:
            status, outcome = EmailIngestionStatus.SKIPPED_NOT_RESUME, "skipped"

        await self.repo.mark_result(message.id, status, candidate_id=first_candidate, error=error)
        await self.db.commit()
        return outcome

    async def _announce_candidate(self, account: EmailAccount, candidate_id: uuid.UUID) -> None:
        """Tell every open workspace in the org that a candidate arrived, so
        candidate lists refresh without a page reload.

        Sent only after the commit, so a browser refetching on receipt
        actually sees the row. And sent to everyone: log_activity's own
        broadcast excludes the acting user, which here is whoever connected
        the mailbox — the one person most likely to be watching for it."""
        try:
            candidate = await self.db.get(Candidate, candidate_id)
            await ws_manager.broadcast_to_org(
                org_id=str(account.organization_id),
                event="candidate_ingested",
                data={
                    "candidate_id": str(candidate_id),
                    "full_name": candidate.full_name if candidate else None,
                    "email_account_address": account.email_address,
                },
            )
        except Exception as e:
            logger.warning(f"Failed to announce ingested candidate {candidate_id}: {e}")

    async def _candidate_from_earlier_attempt(self, message: EmailMessage, filename: str) -> Candidate | None:
        result = await self.db.execute(
            select(Candidate).where(
                Candidate.source_email_message_id == message.id,
                Candidate.resume_filename == filename,
            )
        )
        return result.scalars().first()

    async def _ingest_resume(
        self,
        account: EmailAccount,
        message: EmailMessage,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        from_name: str | None,
        from_address: str | None,
        *,
        multi: bool = False,
        final_attempt: bool = True,
    ) -> tuple[uuid.UUID | None, str]:
        """Create (or match) the candidate for one resume attachment.

        `multi`: the message carries several resumes, so the sender's headers
        say nothing about who this one belongs to and are never used for it.
        `final_attempt`: on a transient parse failure, fall back to a
        header-only candidate instead of raising TransientParseError."""
        organization_id = account.organization_id

        # With several resumes the sender is not the applicant — only their
        # own resumes identify them.
        if multi:
            from_name = from_address = None

        # Cheap identity guess from headers first, so an obvious duplicate
        # sender can skip the expensive AI parse below entirely.
        header_email = from_address
        if header_email:
            existing = await self._find_existing_candidate(organization_id, header_email)
            if existing:
                return await self._link_duplicate(message, existing, account, from_address, from_name)

        # A resume mislabeled with a generic/wrong content-type (some mail
        # clients do this) is still worth attempting via its file extension —
        # matches the same content-type-then-extension fallback storage_service
        # uses for direct uploads.
        looks_like_a_document = mime_type in PARSEABLE_MIME_TYPES or filename.lower().endswith(
            (".pdf", ".doc", ".docx")
        )

        if not looks_like_a_document:
            # Never a resume in practice (spreadsheet, image, archive, etc.).
            # This used to fall through and create a candidate from bare
            # sender headers regardless — which is exactly how a trading-app
            # alert or an event invite with a random attachment became a fake
            # "candidate."
            return None, EmailIngestionStatus.SKIPPED_NOT_RESUME

        try:
            from app.services.ai.resume_parser import parse_resume
            parsed = await parse_resume(
                file_bytes, mime_type, filename,
                background_tasks=None, user_id=None, organization_id=organization_id,
            )
        except HTTPException as e:
            if e.status_code == 400:
                # parse_resume's own content check confidently rejected this
                # (too short, unsupported format, or failed the "is this
                # actually a resume" classifier) — respect that instead of
                # silently creating a candidate from just the sender's email,
                # which is what let a rejected attachment through anyway.
                logger.info(f"Message {message.id} attachment rejected as not-a-resume: {e.detail}")
                return None, EmailIngestionStatus.SKIPPED_NOT_RESUME
            parsed = self._parse_failed(message, filename, e, final_attempt)
        except InsufficientCreditsException as e:
            if not final_attempt:
                raise CreditsExhausted(e.message) from e
            parsed = self._parse_failed(message, filename, e, final_attempt)
        except Exception as e:
            parsed = self._parse_failed(message, filename, e, final_attempt)

        full_name = parsed.get("full_name") or from_name or "Unknown Candidate"
        email = parsed.get("email") or from_address
        if not email:
            clean_name = re.sub(r"[^a-zA-Z0-9]", "", full_name.lower()) or "applicant"
            email = f"{clean_name}.{uuid.uuid4().hex[:6]}@hybent.temp"
        # Same as manual upload: parsed_data carries the email the candidate
        # was actually saved under.
        parsed["email"] = email

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

        # Same fallback as manual upload: a resume whose header omits a
        # current title/company still has them as its latest experience entry.
        current_title = parsed.get("current_title")
        current_company = parsed.get("current_company")
        experience = parsed.get("experience")
        if isinstance(experience, list) and experience and isinstance(experience[0], dict):
            current_title = current_title or experience[0].get("title")
            current_company = current_company or experience[0].get("company")

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
            current_title=current_title,
            current_company=current_company,
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
        apply_experience_fields(candidate, parsed)
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
            broadcast=False,  # announced after commit — see _announce_candidate
        )

        try:
            # Staged on the same session/transaction as the candidate row
            # itself (not committed here) — RAG chunks for a candidate that
            # later rolls back roll back with it, and this never adds an
            # early/extra commit to an already-careful ingestion flow.
            await stage_candidate_resume_chunks(self.db, candidate)
        except Exception as exc:
            logger.warning(f"[RAG] Failed to stage resume chunks for candidate {candidate.id}: {exc}")

        return candidate.id, EmailIngestionStatus.CREATED

    def _parse_failed(self, message: EmailMessage, filename: str, error: Exception, final_attempt: bool) -> dict:
        """A parse failure that isn't a confident "not a resume". Before the
        last attempt it is retried on a later run — creating the candidate
        now would leave it with no experience, education or durations, which
        a manual upload never does. On the last attempt we still don't know
        whether this was a real resume, so it falls back to a needs_review
        candidate from headers rather than losing the application."""
        if not final_attempt:
            logger.info(f"Resume parse failed for {filename} on message {message.id}; will retry: {error}")
            raise TransientParseError(str(error)[:500]) from error
        logger.warning(
            f"Resume parse failed for {filename} on message {message.id} after "
            f"{MAX_INGESTION_ATTEMPTS} attempts, falling back to header metadata: {error}"
        )
        return dict(_EMPTY_PARSED_RESUME)

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
            broadcast=False,
        )
        return existing.id, EmailIngestionStatus.MATCHED_EXISTING
