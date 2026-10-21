import asyncio
import html
import logging
import uuid

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile, File
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.schemas.demo import AssistantRequest, ContactRequest, DemoRequest
from app.services.email_service import send_demo_request_email, send_email
from app.schemas.response import APIResponse

from app.dependencies import DB
from app.models.organization import Organization
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.application import Application
from app.schemas.job import JobPublicOut
from app.services import resume_intake
from app.utils.permissions import ApplicationStage, NotificationType, UserRole
from app.tasks.notifications import notify_organization_roles
from app.services.ai import site_assistant
from app.services import lead_checks

router = APIRouter(prefix="/public", tags=["Public"])
logger = logging.getLogger(__name__)

CONTACT_EMAIL = "info@hybent.com"

# Where a shared apply link was opened from. Links were built for LinkedIn
# posts, so anything missing or unknown is recorded as LinkedIn. "referral"
# is a link a candidate shared from the portal's Job Openings page.
PUBLIC_APPLY_SOURCES = {"linkedin", "careers_page", "referral"}
APPLY_SOURCE_PHRASES = {
    "careers_page": "the careers page.",
    "referral": "a referral link shared by a candidate.",
}


async def _get_active_job_or_404(db: DB, org_slug: str, job_id: uuid.UUID) -> Job:
    org = (await db.execute(
        select(Organization).where(Organization.slug == org_slug)
    )).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = (await db.execute(
        select(Job)
        .where(
            Job.id == job_id,
            Job.organization_id == org.id,
            Job.status == "active",
            Job.is_deleted == False,  # noqa: E712
        )
        .options(selectinload(Job.organization))
    )).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="This job is no longer accepting applications.")
    return job


@router.get("/jobs/{org_slug}/{job_id}")
async def get_public_job(org_slug: str, job_id: uuid.UUID, db: DB):
    """Public, unauthenticated job view — used by the shareable apply link."""
    job = await _get_active_job_or_404(db, org_slug, job_id)
    return APIResponse.success(message="Job retrieved.", data=JobPublicOut.model_validate(job))


@router.post("/jobs/{org_slug}/{job_id}/apply", status_code=201)
async def apply_to_public_job(
    org_slug: str,
    job_id: uuid.UUID,
    db: DB,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    linkedin_url: str | None = Form(None),
    current_ctc: str = Form(...),
    expected_ctc: str = Form(...),
    notice_period: str = Form(...),
    resume: UploadFile = File(...),
    source: str | None = Form(None),
):
    """
    Public, unauthenticated job application — the destination of shareable
    "apply" links (e.g. attached to LinkedIn posts). Creates a standalone
    Candidate (no portal login) and an Application tied to this job; a
    recruiter can later invite the candidate to the portal separately.
    """
    # Sized to their columns (phone 50, LinkedIn 500, CTC 100, notice period
    # 50). Everything is required except the LinkedIn profile.
    phone, linkedin_url = phone.strip(), (linkedin_url or "").strip() or None
    current_ctc, expected_ctc, notice_period = (
        current_ctc.strip(), expected_ctc.strip(), notice_period.strip()
    )
    if not phone:
        raise HTTPException(status_code=400, detail="Please fill in your phone number.")
    if not 7 <= sum(ch.isdigit() for ch in phone) <= 15 or len(phone) > 50:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number.")
    if linkedin_url and ("linkedin.com/" not in linkedin_url.lower() or len(linkedin_url) > 500):
        raise HTTPException(status_code=400, detail="Please enter a valid LinkedIn profile link.")
    if not (current_ctc and expected_ctc and notice_period):
        raise HTTPException(
            status_code=400,
            detail="Please fill in your current CTC, expected CTC and notice period.",
        )
    if len(current_ctc) > 100 or len(expected_ctc) > 100 or len(notice_period) > 50:
        raise HTTPException(status_code=400, detail="CTC or notice period is too long.")
    if source not in PUBLIC_APPLY_SOURCES:
        source = "linkedin"

    job = await _get_active_job_or_404(db, org_slug, job_id)
    resume_content = await resume_intake.read_resume_upload(resume)
    email = email.strip().lower()

    candidate = (await db.execute(
        select(Candidate).where(
            Candidate.email == email,
            Candidate.organization_id == job.organization_id,
        )
    )).scalar_one_or_none()

    if not candidate:
        candidate = Candidate(
            organization_id=job.organization_id,
            created_by_id=None,
            email=email,
            full_name=full_name,
            phone=phone,
            linkedin_url=linkedin_url,
            source=source,
        )
        db.add(candidate)
        await db.flush()
    else:
        existing_application = (await db.execute(
            select(Application).where(
                Application.candidate_id == candidate.id,
                Application.job_id == job.id,
            )
        )).scalar_one_or_none()
        if existing_application:
            raise HTTPException(status_code=409, detail="You have already applied to this job.")

    # Kept current on a returning candidate too — what they enter now is the
    # latest they have told us. The *_salary columns mirror the CTC ones, as
    # the candidate update endpoint keeps them.
    candidate.phone = phone
    if linkedin_url:  # optional — a blank one must not wipe a profile we already have
        candidate.linkedin_url = linkedin_url
    candidate.current_ctc = candidate.current_salary = current_ctc
    candidate.expected_ctc = candidate.expected_salary = expected_ctc
    candidate.notice_period_days = notice_period

    await resume_intake.store_resume(candidate, resume, resume_content)
    candidate.applied_job_title = job.title
    # Parsed and scored like a recruiter upload — this path used to only
    # store the file, so link applicants had no experience and no match score.
    await resume_intake.parse_into_profile(db, candidate, resume_content, resume)

    application = Application(
        organization_id=job.organization_id,
        job_id=job.id,
        candidate_id=candidate.id,
        stage=ApplicationStage.APPLIED,
        source=source,
    )
    db.add(application)
    await resume_intake.score_application(candidate, application, job)
    await db.commit()

    from app.tasks.screening import enqueue_screening
    enqueue_screening([candidate.id], job.organization_id)

    notify_organization_roles.delay(
        str(job.organization_id),
        [UserRole.ADMIN, UserRole.RECRUITER],
        NotificationType.APPLICATION_RECEIVED,
        "New Job Application",
        f"{candidate.full_name} has applied to '{job.title}' via "
        + APPLY_SOURCE_PHRASES.get(source, "a shared application link."),
        {"candidate_id": str(candidate.id), "job_id": str(job.id)},
    )

    return APIResponse.success(message="Application received. The hiring team will be in touch.")

@router.post("/demo-request")
async def demo_request(request: DemoRequest):
    """Handle public demo requests from the landing page."""
    try:
        sent = await asyncio.to_thread(
            send_demo_request_email,
            first_name=request.first_name,
            last_name=request.last_name,
            work_email=request.work_email,
            company_name=request.company_name,
            team_size=request.team_size,
            monthly_hires=request.monthly_hires,
            hiring_challenge=request.hiring_challenge,
        )
    except Exception:
        logger.exception("Demo request email failed.")
        sent = False
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="We couldn't submit your request. Please try again, or email info@hybent.com.",
        )
    return APIResponse.success(message="Demo request submitted successfully. We will get back to you soon!")


CONTACT_THANKS = "Thanks. We have your message and will reply within one business day."

# The [tag] that starts the subject line, so info@ can sort Hybent Hiring
# leads from IT Services ones with a mail filter.
CONTACT_TOPIC_TAGS = {
    "hiring": "Hybent Hiring",
    "services": "IT Services",
}


def _contact_rejected(field: str, message: str) -> HTTPException:
    """A 422 the form shows under the field it names."""
    return HTTPException(status_code=422, detail={"message": message, "field": field})


@router.post("/contact")
async def contact(body: ContactRequest, request: Request):
    """The hybent.com/contact form: checks the submission is plausibly real,
    then emails it to info@ tagged with what the visitor came for."""
    if body.website or (body.elapsed_ms is not None and body.elapsed_ms < lead_checks.MIN_FILL_MS):
        # Honeypot filled in, or sent faster than anyone can type: a bot.
        # Look successful so it doesn't retry.
        logger.info("Contact form bot check triggered; message dropped.")
        return APIResponse.success(message=CONTACT_THANKS)

    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
    if lead_checks.rate_limited(ip):
        raise HTTPException(
            status_code=429,
            detail="You've sent several messages already. Please wait a while, or email info@hybent.com directly.",
        )

    domain = lead_checks.email_domain(body.email)
    if domain in lead_checks.DISPOSABLE_DOMAINS:
        raise _contact_rejected("email", "Temporary inboxes can't receive our reply. Please use your work email.")
    if not await lead_checks.domain_accepts_mail(domain):
        raise _contact_rejected("email", f"{domain} can't receive email. Please check the spelling.")

    phone = lead_checks.parse_phone(body.phone)
    if phone is None:
        raise _contact_rejected("phone", "That phone number isn't valid for the selected country.")

    checks = [
        "⚠️ Free email (not a company domain)" if domain in lead_checks.FREE_EMAIL_DOMAINS else "✅ Company email",
        "✅ Valid phone",
    ]
    topic = CONTACT_TOPIC_TAGS[body.topic]
    rows = [
        ("Topic", topic),
        ("Service", body.service),
        ("Industry", body.industry),
        ("Role to hire", body.role),
        ("Company size", body.team_size),
        ("People hired per year", body.hires_per_year),
        ("Company", body.company),
        ("Phone", phone[0]),
        ("Country", phone[1]),
        ("Location", body.location),
        ("How they heard about us", body.referrer),
        ("Came from", body.came_from),
        ("Landing page", body.landing_page),
        ("Referring site", body.external_referrer),
        ("Campaign", " / ".join(v for v in (body.utm_source, body.utm_medium, body.utm_campaign) if v) or None),
        ("Checks", " · ".join(checks)),
    ]
    details = "".join(
        f"<tr><td style=\"padding:4px 16px 4px 0;color:#70757a;vertical-align:top\">{label}</td><td>{html.escape(value)}</td></tr>"
        for label, value in rows if value
    )
    email = html.escape(body.email)
    html_body = (
        f"<p><b>{html.escape(body.name)}</b> &lt;<a href=\"mailto:{email}\">{email}</a>&gt; "
        "sent a message from hybent.com/contact.</p>"
        f"<table>{details}</table>"
        f"<p style=\"white-space:pre-wrap\">{html.escape(body.message)}</p>"
        f"<p><a href=\"mailto:{email}\">Reply to {html.escape(body.name)}</a></p>"
    )
    context = body.service or body.role
    subject = (
        f"[{topic}] {body.name}"
        + (f" – {body.company}" if body.company else "")
        + (f" ({context})" if context else "")
    )
    sent = await asyncio.to_thread(send_email, CONTACT_EMAIL, subject, html_body)
    if not sent:
        raise HTTPException(
            status_code=502,
            detail="We couldn't send your message. Please email info@hybent.com directly.",
        )
    return APIResponse.success(message=CONTACT_THANKS)


@router.post("/assistant")
async def assistant(body: AssistantRequest, request: Request):
    """Hybent AI, the hybent.com chatbot: answers visitor questions from the site's content."""
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
    if site_assistant.rate_limited(ip):
        raise HTTPException(status_code=429, detail="Too many messages. Please wait a minute and try again.")

    history = [t.model_dump() for t in body.messages][-12:]
    if history[-1]["role"] != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the visitor.")
    reply, followups = await site_assistant.answer(history)
    return APIResponse.success(message="ok", data={"reply": reply, "followups": followups})
