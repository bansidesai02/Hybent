"""Auto-candidate-ingestion from inbound email attachments: attachment
extraction/filtering, dedupe, org isolation, the unconditional needs_review
gate, and the ingestion-status claim lock."""
import base64
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.candidate import Candidate
from app.models.email_account import EmailAccount, EmailAccountProvider
from app.models.email_message import EmailIngestionStatus, EmailMessage
from app.repositories.email_message import EmailMessageRepository
from app.services.email_ingestion_service import EmailApplicationIngestionService, _select_attachments
from app.services.email_providers import gmail_provider
from app.utils import crypto


def _gmail_account(organization_id, **overrides) -> EmailAccount:
    defaults = dict(
        organization_id=organization_id,
        provider=EmailAccountProvider.GMAIL,
        email_address="careers@acme.com",
        refresh_token_encrypted=crypto.encrypt("refresh-token"),
    )
    defaults.update(overrides)
    return EmailAccount(**defaults)


def _empty_parsed(**overrides) -> dict:
    parsed = {
        "full_name": None, "email": None, "phone": None, "location": None,
        "current_title": None, "current_company": None, "years_experience": None,
        "experience_years": None, "summary": None, "linkedin_url": None,
        "github_url": None, "portfolio_url": None, "skills": [], "education": [],
        "experience": [], "projects": [], "certifications": [], "languages": [],
    }
    parsed.update(overrides)
    return parsed


# ─── gmail_provider: attachment extraction (pure, no DB) ───────────────────

def test_extract_attachment_parts_inline_and_attachment_id():
    inline_b64 = base64.urlsafe_b64encode(b"pdf-bytes").decode()
    payload = {
        "mimeType": "multipart/mixed",
        "parts": [
            {"mimeType": "text/plain", "body": {"data": base64.urlsafe_b64encode(b"hi").decode()}},
            {
                "mimeType": "multipart/mixed",
                "parts": [
                    {"filename": "resume.pdf", "mimeType": "application/pdf", "body": {"size": 9, "data": inline_b64}},
                    {"filename": "big.pdf", "mimeType": "application/pdf", "body": {"size": 900000, "attachmentId": "att-1"}},
                ],
            },
        ],
    }
    attachments = gmail_provider._extract_attachment_parts(payload)
    assert len(attachments) == 2
    assert attachments[0]["filename"] == "resume.pdf"
    assert attachments[0]["inline_data"] == inline_b64
    assert attachments[1]["attachment_id"] == "att-1"


def test_get_attachment_content_decodes_inline_without_api_call():
    account = _gmail_account(organization_id="00000000-0000-0000-0000-000000000000")
    data = base64.urlsafe_b64encode(b"hello world").decode()
    with patch("app.services.email_providers.gmail_provider.get_attachment_bytes") as mock_fetch:
        content = gmail_provider.get_attachment_content(account, "m1", {"inline_data": data})
    assert content == b"hello world"
    mock_fetch.assert_not_called()


def test_get_attachment_content_fetches_when_no_inline_data():
    account = _gmail_account(organization_id="00000000-0000-0000-0000-000000000000")
    with patch("app.services.email_providers.gmail_provider.get_attachment_bytes", return_value=b"fetched") as mock_fetch:
        content = gmail_provider.get_attachment_content(account, "m1", {"attachment_id": "att-1"})
    assert content == b"fetched"
    mock_fetch.assert_called_once_with(account, "m1", "att-1")


# ─── _select_attachment filter (pure, no DB) ────────────────────────────────

def test_select_attachment_skips_signature_images_and_missing_filename():
    attachments = [
        {"filename": None, "mime_type": "application/pdf", "size": 100},
        {"filename": "logo.png", "mime_type": "image/png", "size": 100},
        {"filename": "resume.pdf", "mime_type": "application/pdf", "size": 100},
    ]
    picked = _select_attachments(attachments)
    assert [a["filename"] for a in picked] == ["resume.pdf"]


def test_select_attachment_skips_oversized_and_non_document_types():
    from app.core.config import settings
    attachments = [
        {"filename": "huge.pdf", "mime_type": "application/pdf", "size": settings.max_file_size_bytes + 1},
        {"filename": "profile.zip", "mime_type": "application/zip", "size": 100},
        {"filename": "invoice.xlsx", "mime_type": "application/vnd.ms-excel", "size": 100},
    ]
    assert _select_attachments(attachments) == []  # nothing here is a resume-shaped document


def test_select_attachment_falls_back_to_extension_for_generic_mime_type():
    """Some mail clients send PDFs/DOCs with a generic mime type — the
    filename extension is still enough to qualify the attachment for the
    (later, content-based) resume check."""
    attachments = [{"filename": "resume.docx", "mime_type": "application/octet-stream", "size": 100}]
    picked = _select_attachments(attachments)
    assert [a["filename"] for a in picked] == ["resume.docx"]


def test_select_attachment_returns_none_when_nothing_qualifies():
    assert _select_attachments([{"filename": "logo.gif", "mime_type": "image/gif", "size": 1}]) == []


def test_select_attachments_returns_every_resume():
    attachments = [
        {"filename": "alice.pdf", "mime_type": "application/pdf", "size": 100},
        {"filename": "logo.png", "mime_type": "image/png", "size": 100},
        {"filename": "bob.docx", "mime_type": "application/octet-stream", "size": 100},
    ]
    assert [a["filename"] for a in _select_attachments(attachments)] == ["alice.pdf", "bob.docx"]


# ─── EmailMessageRepository claim/mark (DB) ────────────────────────────────

async def test_claim_for_processing_prevents_double_claim(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    message = EmailMessage(organization_id=organization.id, email_account_id=account.id, provider_message_id="m1")
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)

    repo = EmailMessageRepository(db_session)
    assert await repo.claim_for_processing(message.id) is True
    await db_session.commit()
    assert await repo.claim_for_processing(message.id) is False


async def test_claim_for_processing_reclaims_stale_lock(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id, provider_message_id="m1",
        ingestion_status=EmailIngestionStatus.PROCESSING,
        ingestion_locked_at=datetime.now(timezone.utc) - timedelta(minutes=30),
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)

    repo = EmailMessageRepository(db_session)
    assert await repo.claim_for_processing(message.id, stale_after_minutes=15) is True


# ─── EmailApplicationIngestionService: end-to-end candidate creation ───────

def _full_message_payload(from_name="Bob Applicant", from_address="bob@candidate.com", subject="Application"):
    return {
        "body_text": None, "body_html": None,
        "attachments": [{"filename": "resume.pdf", "mime_type": "application/pdf", "size": 100, "inline_data": "x"}],
        "from_name": from_name, "from_address": from_address, "subject": subject,
    }


async def _make_message(db_session, organization, account) -> EmailMessage:
    message = EmailMessage(
        organization_id=organization.id, email_account_id=account.id, provider_message_id="m1",
        from_address="bob@candidate.com", from_name="Bob Applicant", subject="Application",
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    return message


async def test_process_message_creates_candidate_in_needs_review(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    parsed = _empty_parsed(full_name="Bob Applicant", email="bob@candidate.com", skills=["python"])
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        service = EmailApplicationIngestionService(db_session)
        outcome = await service.process_message(account, message)

    assert outcome == "created"
    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.CREATED
    assert message.ingestion_result_candidate_id is not None

    candidate = await db_session.get(Candidate, message.ingestion_result_candidate_id)
    assert candidate.organization_id == organization.id
    assert candidate.created_by_id is None  # no connected_by_user_id on this account fixture
    assert candidate.source == "email"
    assert candidate.source_email_message_id == message.id
    assert candidate.source_email_account_id == account.id
    assert candidate.pipeline_stage == "needs_review"


async def test_process_message_credits_the_user_who_connected_the_mailbox(db_session, organization, admin_user):
    """The candidate should show up as added by whoever connected the
    receiving mailbox — not as an anonymous system action."""
    account = _gmail_account(organization.id, connected_by_user_id=admin_user.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    parsed = _empty_parsed(full_name="Bob Applicant", email="bob@candidate.com")
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        service = EmailApplicationIngestionService(db_session)
        await service.process_message(account, message)

    candidate = await db_session.get(Candidate, message.ingestion_result_candidate_id)
    assert candidate.created_by_id == admin_user.id

    from sqlalchemy import select
    from app.models.audit_log import AuditLog
    activity = (await db_session.execute(
        select(AuditLog).where(AuditLog.resource_id == str(candidate.id), AuditLog.action == "CREATE")
    )).scalar_one()
    assert activity.user_id == admin_user.id


async def test_process_message_dedupes_existing_candidate_without_reparsing(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    existing = Candidate(
        organization_id=organization.id, email="bob@candidate.com", full_name="Bob Applicant",
    )
    db_session.add(existing)
    await db_session.commit()
    await db_session.refresh(existing)

    message = await _make_message(db_session, organization, account)

    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock()) as mock_parse:
        service = EmailApplicationIngestionService(db_session)
        outcome = await service.process_message(account, message)

    assert outcome == "matched_existing"
    mock_parse.assert_not_called()  # known duplicate by sender address — skip the expensive AI parse
    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.MATCHED_EXISTING
    assert message.ingestion_result_candidate_id == existing.id

    # still exactly one candidate with this email in the org
    from sqlalchemy import select, func
    count = (await db_session.execute(
        select(func.count()).select_from(Candidate).where(Candidate.email == "bob@candidate.com")
    )).scalar_one()
    assert count == 1


async def test_process_message_org_isolation_same_email_different_orgs(
    db_session, organization, other_organization
):
    account_a = _gmail_account(organization.id, email_address="careers@acme.com")
    account_b = _gmail_account(other_organization.id, email_address="careers@other.com")
    db_session.add_all([account_a, account_b])
    await db_session.commit()
    await db_session.refresh(account_a)
    await db_session.refresh(account_b)

    message_a = EmailMessage(
        organization_id=organization.id, email_account_id=account_a.id, provider_message_id="m1",
        from_address="bob@candidate.com", from_name="Bob Applicant",
    )
    message_b = EmailMessage(
        organization_id=other_organization.id, email_account_id=account_b.id, provider_message_id="m1",
        from_address="bob@candidate.com", from_name="Bob Applicant",
    )
    db_session.add_all([message_a, message_b])
    await db_session.commit()
    await db_session.refresh(message_a)
    await db_session.refresh(message_b)

    parsed = _empty_parsed(full_name="Bob Applicant", email="bob@candidate.com")
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        service = EmailApplicationIngestionService(db_session)
        await service.process_message(account_a, message_a)
        await service.process_message(account_b, message_b)

    from sqlalchemy import select
    candidates = (await db_session.execute(select(Candidate).where(Candidate.email == "bob@candidate.com"))).scalars().all()
    assert len(candidates) == 2
    assert {c.organization_id for c in candidates} == {organization.id, other_organization.id}


async def test_process_message_non_document_attachment_is_skipped(db_session, organization):
    """A non-document attachment (zip, image, spreadsheet, etc.) is never a
    real resume in practice — it used to fall through and create a candidate
    from bare From: header data regardless, which is how automated/marketing
    emails with random attachments turned into fake candidates. It should be
    skipped instead, same as a message with no attachment at all."""
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    payload = _full_message_payload()
    payload["attachments"] = [{"filename": "profile.zip", "mime_type": "application/zip", "size": 100, "inline_data": "x"}]

    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=payload), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"zip-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock()) as mock_parse:
        service = EmailApplicationIngestionService(db_session)
        outcome = await service.process_message(account, message)

    assert outcome == "skipped"
    mock_parse.assert_not_called()  # not a document — never attempted
    assert message.ingestion_result_candidate_id is None


async def test_process_message_rejected_as_not_a_resume_is_skipped(db_session, organization):
    """A PDF/DOC/DOCX attachment that parse_resume's own content validation
    confidently rejects (too short, or fails the is-this-a-resume check —
    both raise HTTPException(400)) should be skipped, not turned into a
    candidate from just the sender's email."""
    from fastapi import HTTPException

    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    payload = _full_message_payload()
    payload["attachments"] = [{"filename": "invoice.pdf", "mime_type": "application/pdf", "size": 100, "inline_data": "x"}]

    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=payload), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch(
             "app.services.ai.resume_parser.parse_resume",
             new=AsyncMock(side_effect=HTTPException(status_code=400, detail="Invalid document.")),
         ):
        service = EmailApplicationIngestionService(db_session)
        outcome = await service.process_message(account, message)

    assert outcome == "skipped"
    assert message.ingestion_result_candidate_id is None


async def test_process_account_does_not_reprocess_on_second_run(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    await _make_message(db_session, organization, account)

    parsed = _empty_parsed(full_name="Bob Applicant", email="bob@candidate.com")
    with patch("app.services.email_ingestion_service.EmailInboxService.sync_account", new=AsyncMock(return_value=0)), \
         patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()) as mock_full, \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        service = EmailApplicationIngestionService(db_session)
        first = await service.process_account(account)
        second = await service.process_account(account)

    assert first["created"] == 1
    assert second == {"created": 0, "matched_existing": 0, "skipped": 0, "failed": 0}
    mock_full.assert_called_once()  # second run never re-fetched the already-processed message


# ─── Multiple resumes per email ────────────────────────────────────────────

def _multi_resume_payload(*filenames, from_name="Agency Recruiter", from_address="jobs@agency.com"):
    return {
        "body_text": None, "body_html": None,
        "attachments": [
            {"filename": f, "mime_type": "application/pdf", "size": 100, "inline_data": "x"} for f in filenames
        ],
        "from_name": from_name, "from_address": from_address, "subject": "Three profiles for you",
    }


def _parse_by_filename(by_filename: dict):
    """parse_resume stand-in that answers per attachment."""
    async def _parse(file_bytes, mime_type, filename, **kwargs):
        result = by_filename[filename]
        if isinstance(result, Exception):
            raise result
        return dict(result)
    return AsyncMock(side_effect=_parse)


async def test_process_message_creates_a_candidate_per_resume(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    parse = _parse_by_filename({
        "alice.pdf": _empty_parsed(full_name="Alice", email="alice@x.com"),
        "bob.pdf": _empty_parsed(full_name="Bob", email="bob@x.com"),
        "carol.pdf": _empty_parsed(full_name="Carol", email="carol@x.com"),
    })
    with patch("app.services.email_providers.gmail_provider.get_message_full",
               return_value=_multi_resume_payload("alice.pdf", "bob.pdf", "carol.pdf")), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=parse):
        outcome = await EmailApplicationIngestionService(db_session).process_message(account, message)

    assert outcome == "created"
    from sqlalchemy import select
    candidates = (await db_session.execute(
        select(Candidate).where(Candidate.source_email_message_id == message.id)
    )).scalars().all()
    assert sorted(c.email for c in candidates) == ["alice@x.com", "bob@x.com", "carol@x.com"]
    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.CREATED
    assert message.ingestion_result_candidate_id in {c.id for c in candidates}


async def test_multi_resume_email_does_not_match_every_resume_to_the_sender(db_session, organization):
    """With several resumes attached the sender is an agency or referrer —
    an existing candidate under the sender's address must not swallow them."""
    account = _gmail_account(organization.id)
    db_session.add(account)
    db_session.add(Candidate(organization_id=organization.id, email="jobs@agency.com", full_name="Agency"))
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    parse = _parse_by_filename({
        "alice.pdf": _empty_parsed(full_name="Alice", email="alice@x.com"),
        # No email on the resume: must get a generated one, not the sender's.
        "noemail.pdf": _empty_parsed(full_name="Dan Doe"),
    })
    with patch("app.services.email_providers.gmail_provider.get_message_full",
               return_value=_multi_resume_payload("alice.pdf", "noemail.pdf")), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=parse):
        outcome = await EmailApplicationIngestionService(db_session).process_message(account, message)

    assert outcome == "created"
    assert parse.await_count == 2
    from sqlalchemy import select
    emails = sorted((await db_session.execute(
        select(Candidate.email).where(Candidate.source_email_message_id == message.id)
    )).scalars().all())
    assert emails[0] == "alice@x.com"
    assert emails[1].startswith("dandoe.") and emails[1].endswith("@hybent.temp")


# ─── Transient parse failures retry instead of creating empty candidates ──

async def test_transient_parse_failure_retries_then_falls_back(db_session, organization):
    from fastapi import HTTPException
    from app.models.email_message import MAX_INGESTION_ATTEMPTS

    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    rate_limited = AsyncMock(side_effect=HTTPException(status_code=429, detail="rate limited"))
    service = EmailApplicationIngestionService(db_session)
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=rate_limited):
        for _ in range(MAX_INGESTION_ATTEMPTS - 1):
            assert await service.process_message(account, message) == "retry"
            await db_session.refresh(message)
            assert message.ingestion_status == EmailIngestionStatus.RETRY_PENDING
            assert message.ingestion_result_candidate_id is None

        # Still picked up by the next run while attempts remain.
        assert message in await EmailMessageRepository(db_session).get_unprocessed(account.id)

        # Last attempt: header-metadata fallback so the application isn't lost.
        assert await service.process_message(account, message) == "created"

    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.CREATED
    assert message.ingestion_attempts == MAX_INGESTION_ATTEMPTS
    candidate = await db_session.get(Candidate, message.ingestion_result_candidate_id)
    assert candidate.email == "bob@candidate.com"


async def test_retry_does_not_reparse_resumes_already_created(db_session, organization):
    from fastapi import HTTPException

    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)
    payload = _multi_resume_payload("alice.pdf", "bob.pdf")
    service = EmailApplicationIngestionService(db_session)

    first = _parse_by_filename({
        "alice.pdf": _empty_parsed(full_name="Alice", email="alice@x.com"),
        "bob.pdf": HTTPException(status_code=429, detail="rate limited"),
    })
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=payload), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=first):
        assert await service.process_message(account, message) == "retry"

    await db_session.refresh(message)
    alice_id = message.ingestion_result_candidate_id
    assert alice_id is not None  # kept while the other resume retries

    second = _parse_by_filename({"bob.pdf": _empty_parsed(full_name="Bob", email="bob@x.com")})
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=payload), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=second):
        assert await service.process_message(account, message) == "created"

    assert second.await_count == 1  # only bob.pdf was parsed again
    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.CREATED
    assert message.ingestion_result_candidate_id == alice_id


async def test_credits_exhausted_stops_the_batch(db_session, organization):
    from app.utils.exceptions import InsufficientCreditsException

    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    for i in range(2):
        db_session.add(EmailMessage(
            organization_id=organization.id, email_account_id=account.id, provider_message_id=f"m{i}",
            from_address=f"c{i}@x.com", received_at=datetime.now(timezone.utc) + timedelta(seconds=i),
        ))
    await db_session.commit()

    no_credits = AsyncMock(side_effect=InsufficientCreditsException())
    with patch("app.services.email_ingestion_service.EmailInboxService.sync_account", new=AsyncMock(return_value=0)), \
         patch("app.services.email_ingestion_service.PARSE_SPACING_SECONDS", 0), \
         patch("app.services.email_providers.gmail_provider.get_message_full",
               return_value=_full_message_payload(from_address="nobody@x.com")), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=no_credits):
        counts = await EmailApplicationIngestionService(db_session).process_account(account)

    assert counts["retry"] == 1
    assert no_credits.await_count == 1  # second message never attempted


# ─── Parity with manual upload ─────────────────────────────────────────────

async def test_created_candidate_matches_manual_upload_fields(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    experience = [{"title": "Backend Engineer", "company": "Acme", "duration": "Jan 2020 - Dec 2022", "description": ""}]
    parsed = _empty_parsed(
        full_name="Bob Applicant", email="bob@candidate.com",
        years_experience=3.0, experience_years="3 Years", experience=experience,
    )
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        await EmailApplicationIngestionService(db_session).process_message(account, message)

    await db_session.refresh(message)
    candidate = await db_session.get(Candidate, message.ingestion_result_candidate_id)
    assert candidate.current_title == "Backend Engineer"
    assert candidate.current_company == "Acme"
    assert candidate.years_experience == 3.0
    assert candidate.experience_years == "3 Years"
    assert candidate.parsed_data["experience"][0]["duration"] == "Jan 2020 - Dec 2022"
    assert candidate.parsed_data["email"] == "bob@candidate.com"


async def test_each_created_candidate_is_announced_to_the_whole_org(db_session, organization, admin_user):
    """The mailbox's connecting user is the activity's actor, and log_activity's
    own broadcast skips the actor — ingestion announces each candidate itself,
    after commit, to everyone."""
    account = _gmail_account(organization.id, connected_by_user_id=admin_user.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    parse = _parse_by_filename({
        "alice.pdf": _empty_parsed(full_name="Alice", email="alice@x.com"),
        "bob.pdf": _empty_parsed(full_name="Bob", email="bob@x.com"),
    })
    broadcast = AsyncMock()
    with patch("app.services.email_providers.gmail_provider.get_message_full",
               return_value=_multi_resume_payload("alice.pdf", "bob.pdf")), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=parse), \
         patch("app.services.email_ingestion_service.ws_manager.broadcast_to_org", new=broadcast), \
         patch("app.services.activity_service.ws_manager.broadcast_to_org", new=broadcast):
        await EmailApplicationIngestionService(db_session).process_message(account, message)

    events = [c.kwargs for c in broadcast.await_args_list]
    assert [e["event"] for e in events] == ["candidate_ingested", "candidate_ingested"]
    assert sorted(e["data"]["full_name"] for e in events) == ["Alice", "Bob"]
    assert all(e["org_id"] == str(organization.id) and "exclude_user_id" not in e for e in events)


async def test_gmail_fetch_failure_is_retried_not_terminal(db_session, organization):
    account = _gmail_account(organization.id)
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)
    message = await _make_message(db_session, organization, account)

    service = EmailApplicationIngestionService(db_session)
    with patch("app.services.email_providers.gmail_provider.get_message_full",
               side_effect=OSError("[Errno 101] Network is unreachable")):
        assert await service.process_message(account, message) == "retry"
    await db_session.refresh(message)
    assert message.ingestion_status == EmailIngestionStatus.RETRY_PENDING

    parsed = _empty_parsed(full_name="Bob Applicant", email="bob@candidate.com")
    with patch("app.services.email_providers.gmail_provider.get_message_full", return_value=_full_message_payload()), \
         patch("app.services.email_providers.gmail_provider.get_attachment_content", return_value=b"pdf-bytes"), \
         patch("app.services.ai.resume_parser.parse_resume", new=AsyncMock(return_value=parsed)):
        assert await service.process_message(account, message) == "created"
