"""
Hybent Talent Network.

Candidate side (public, no login; every action is a secret link by email):
  signup()   - resume + consent -> profile (hidden until the email is confirmed)
  verify()   - confirm email -> searchable
  manage_*() - see, hide/show or delete their profile
  respond()  - accept / decline a company's contact request

Company side (Global Search "Hybent Network" tab):
  search_network()  - verified, visible profiles; names shortened, no contact details
  request_contact() - asks the candidate; on "yes" they become a normal
                      Candidate in that company (and in the job's pipeline)

The privacy rule: a company never sees a network member's email or phone
until that member says yes to that company.
"""
import html
import logging
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.application import Application
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.organization import Organization
from app.models.talent_network import TalentContactRequest, TalentProfile
from app.models.user import User
from app.services.email_service import _get_base_template, send_email

logger = logging.getLogger(__name__)

CONSENT_VERSION = "2026-11-28"
CONSENT_TEXT = (
    "I want companies hiring on Hybent to be able to find my profile (name shortened, no contact "
    "details). A company gets my email and phone only if I accept its request. I can hide or delete "
    "my profile at any time from the link in my emails."
)
SOURCE = "talent_network"


def _now():
    return datetime.now(timezone.utc)


def _token() -> str:
    return secrets.token_urlsafe(32)


def _url(path: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}{path}"


def short_name(full_name: str) -> str:
    """'Priya Sharma' -> 'Priya S.'"""
    parts = (full_name or "").split()
    if not parts:
        return "Network member"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0].upper()}."


def _esc(s) -> str:
    return html.escape(str(s or ""))


# ── Candidate side ─────────────────────────────────────────────────────────

def _apply_parsed(p: TalentProfile, parsed: dict) -> None:
    p.parsed_data = parsed
    if parsed.get("skills"):
        p.skills = [s for s in parsed["skills"] if isinstance(s, str)][:30]
    exp = parsed.get("experience")
    first = exp[0] if isinstance(exp, list) and exp and isinstance(exp[0], dict) else {}
    p.current_title = parsed.get("current_title") or first.get("title") or p.current_title
    p.current_company = parsed.get("current_company") or first.get("company") or p.current_company
    p.summary = parsed.get("summary") or p.summary
    p.location = p.location or parsed.get("location")
    p.linkedin_url = p.linkedin_url or parsed.get("linkedin_url")
    try:
        from app.services.ai import resume_parser
        years, _ = resume_parser.calculate_years_from_experience(exp if isinstance(exp, list) else [])
        if years is not None:
            p.years_experience = years
    except Exception:
        pass


async def signup(db: AsyncSession, *, full_name: str, email: str, phone: str | None, location: str | None,
                 looking_for: str | None, linkedin_url: str | None, source: str | None) -> uuid.UUID:
    """Saves the profile from what they typed and returns its id, fast. The
    email and the resume parse run afterwards in finish_signup(), so the
    candidate isn't kept waiting on the AI (a parse can take ~30s). Says
    nothing about whether the email was already in the network."""
    p = (await db.execute(select(TalentProfile).where(TalentProfile.email == email))).scalar_one_or_none()
    if p is None:
        p = TalentProfile(email=email, manage_token=_token())
        db.add(p)
    p.full_name = full_name
    p.phone = phone or p.phone
    p.location = location or p.location
    p.looking_for = looking_for or p.looking_for
    p.linkedin_url = linkedin_url or p.linkedin_url
    p.source = p.source or (source or "website")[:50]
    p.consent_at = _now()
    p.consent_version = CONSENT_VERSION
    if not p.email_verified_at:
        p.verify_token = _token()
    await db.flush()
    return p.id


async def finish_signup(profile_id: uuid.UUID, resume: bytes, content_type: str, filename: str) -> None:
    """Background step after signup: email the confirm (or "updated") link
    first, then read the resume into the profile."""
    import asyncio

    from app.core.database import AsyncSessionLocal
    from app.services.ai import resume_parser

    async with AsyncSessionLocal() as db:
        p = (await db.execute(select(TalentProfile).where(TalentProfile.id == profile_id))).scalar_one_or_none()
        if not p:
            return
        first = _esc(p.full_name.split()[0])
        if p.email_verified_at:
            subject, content = "Your Hybent Talent Network profile is updated", f"""
                <h2 class="title">Profile updated</h2>
                <p class="description">Hi {first}, we refreshed your profile from your new resume.
                Companies hiring on Hybent can find it; they see your contact details only if you accept their request.</p>
                <div class="button-wrap"><a href="{_url('/talent/manage/' + p.manage_token)}" class="button">See or change my profile</a></div>"""
        else:
            subject, content = "Confirm your Hybent Talent Network profile", f"""
                <h2 class="title">One click to go live</h2>
                <p class="description">Hi {first}, confirm your email and companies hiring on
                Hybent can start finding your profile. They never see your email or phone unless you say yes to them.</p>
                <div class="button-wrap"><a href="{_url('/talent/verify/' + (p.verify_token or ''))}" class="button">Confirm my email</a></div>
                <p class="description" style="font-size:13px">Didn't sign up? Ignore this email and nothing is shown to anyone.</p>"""
        await asyncio.to_thread(_send, p.email, subject, content)

        try:
            parsed = await resume_parser.parse_resume(resume, content_type, filename)
        except Exception as exc:  # not a resume, unreadable, AI down: keep what they typed
            logger.warning("[TalentNetwork] resume parse failed for %s: %s: %s", profile_id, type(exc).__name__, exc)
            return
        _apply_parsed(p, parsed)
        await db.commit()


def _send(to: str, subject: str, content: str) -> None:
    try:
        send_email(to, subject, _get_base_template(content))
    except Exception as exc:  # email must never break the request
        logger.warning("[TalentNetwork] email to %s failed: %s", to, exc)


async def verify(db: AsyncSession, token: str) -> TalentProfile | None:
    """Idempotent: opening the link twice (a second tab, React's dev double
    render, an email scanner) still answers "confirmed"."""
    p = (await db.execute(select(TalentProfile).where(TalentProfile.verify_token == token))).scalar_one_or_none()
    if not p:
        return None
    p.email_verified_at = p.email_verified_at or _now()
    await db.flush()
    return p


async def by_manage_token(db: AsyncSession, token: str) -> TalentProfile | None:
    return (await db.execute(select(TalentProfile).where(TalentProfile.manage_token == token))).scalar_one_or_none()


async def requests_for(db: AsyncSession, p: TalentProfile) -> list[dict]:
    """Companies that asked this member for contact, newest first, so the
    manage page can answer them even if the email went to spam."""
    rows = (await db.execute(
        select(TalentContactRequest, Organization.name, Job.title)
        .join(Organization, Organization.id == TalentContactRequest.organization_id)
        .outerjoin(Job, Job.id == TalentContactRequest.job_id)
        .where(TalentContactRequest.profile_id == p.id)
        .order_by(TalentContactRequest.created_at.desc())
    )).all()
    return [{"company": org, "job_title": job, "status": r.status, "token": r.token,
             "message": r.message, "created_at": r.created_at.isoformat() if r.created_at else None}
            for r, org, job in rows]


def profile_out(p: TalentProfile) -> dict:
    """What the candidate sees of their own profile."""
    return {
        "full_name": p.full_name, "email": p.email, "phone": p.phone, "location": p.location,
        "current_title": p.current_title, "current_company": p.current_company,
        "years_experience": p.years_experience, "skills": p.skills or [], "looking_for": p.looking_for,
        "is_visible": p.is_visible, "verified": bool(p.email_verified_at),
        "shown_to_companies_as": short_name(p.full_name),
    }


# ── Company side ───────────────────────────────────────────────────────────

async def search_network(db: AsyncSession, organization_id: uuid.UUID, f: dict, limit: int = 20) -> list[dict]:
    conds = [TalentProfile.email_verified_at.isnot(None), TalentProfile.is_visible.is_(True)]
    text_or = []
    for t in f["job_titles"]:
        text_or += [TalentProfile.current_title.ilike(f"%{t}%"), TalentProfile.looking_for.ilike(f"%{t}%")]
    if f["skills"]:
        joined = func.lower(func.array_to_string(TalentProfile.skills, "|"))
        text_or += [joined.like(f"%{s}%") for s in f["skills"]]
    if text_or:
        conds.append(or_(*text_or))
    # City is matched in Python below, loosely: candidates type their own city
    # and misspell it ("Ahemedabad"), and a strict match would hide them.
    if f["min_years"] is not None:
        conds.append(or_(TalentProfile.years_experience.is_(None), TalentProfile.years_experience >= f["min_years"]))
    if f["max_years"] is not None:
        conds.append(or_(TalentProfile.years_experience.is_(None), TalentProfile.years_experience <= f["max_years"]))

    rows = (await db.execute(
        select(TalentProfile).where(*conds).order_by(TalentProfile.updated_at.desc()).limit(limit * 10)
    )).scalars().all()
    if f["city"]:
        rows = [p for p in rows if city_matches(p.location, f["city"])]
    rows = rows[:limit]
    if not rows:
        return []
    reqs = {r.profile_id: r for r in (await db.execute(
        select(TalentContactRequest).where(
            TalentContactRequest.organization_id == organization_id,
            TalentContactRequest.profile_id.in_([p.id for p in rows]),
        )
    )).scalars().all()}

    out = []
    for p in rows:
        r = reqs.get(p.id)
        out.append({
            "external_id": f"tn-{p.id}",
            "profile_id": str(p.id),
            "full_name": short_name(p.full_name),
            "job_title": p.current_title or p.looking_for,
            "company": p.current_company,
            "location": p.location,
            "years_experience": p.years_experience,
            "skills": (p.skills or [])[:12],
            "matched_skills": [],
            "looking_for": p.looking_for,
            "has_email": True, "has_phone": bool(p.phone), "has_linkedin": False, "linkedin_url": None,
            "source": "network",
            "request_status": r.status if r else None,
            "candidate_id": str(r.candidate_id) if r and r.candidate_id else None,
        })
    return out


def city_matches(location: str | None, city: str) -> bool:
    """Loose city match: known alternate names (Bangalore/Bengaluru) and small
    typos (Ahemedabad ~ Ahmedabad, 80%+ similar)."""
    import difflib
    import re

    from app.services.global_search_service import CITY_ALIASES
    if not location:
        return False
    words = [w for w in re.split(r"[^a-z]+", location.lower()) if len(w) > 2]
    for target in CITY_ALIASES.get(city, [city]):
        for w in words:
            if w == target or difflib.SequenceMatcher(None, w, target).ratio() >= 0.8:
                return True
    return False


class RequestError(Exception):
    pass


async def request_contact(db: AsyncSession, *, organization_id: uuid.UUID, user: User, profile_id: uuid.UUID,
                          job_id: uuid.UUID | None, message: str | None) -> TalentContactRequest:
    p = (await db.execute(select(TalentProfile).where(
        TalentProfile.id == profile_id, TalentProfile.email_verified_at.isnot(None), TalentProfile.is_visible.is_(True),
    ))).scalar_one_or_none()
    if not p:
        raise RequestError("This profile is no longer available.")
    existing = (await db.execute(select(TalentContactRequest).where(
        TalentContactRequest.profile_id == p.id, TalentContactRequest.organization_id == organization_id,
    ))).scalar_one_or_none()
    if existing:
        raise RequestError({"pending": "You already asked this candidate. Waiting for their answer.",
                            "accepted": "This candidate already accepted. They are in your candidates.",
                            "declined": "This candidate said no to your company."}[existing.status])

    org = (await db.execute(select(Organization).where(Organization.id == organization_id))).scalar_one()
    job = None
    if job_id:
        job = (await db.execute(select(Job).where(Job.id == job_id, Job.organization_id == organization_id))).scalar_one_or_none()

    req = TalentContactRequest(profile_id=p.id, organization_id=organization_id, requested_by_id=user.id,
                               job_id=job.id if job else None, message=(message or "").strip()[:1000] or None,
                               token=_token())
    db.add(req)
    await db.flush()

    role = f" for the <strong>{_esc(job.title)}</strong> role" if job else ""
    note = f'<p class="description"><em>"{_esc(req.message)}"</em></p>' if req.message else ""
    yes, no = _url(f"/talent/respond/{req.token}?answer=yes"), _url(f"/talent/respond/{req.token}?answer=no")
    _send(p.email, f"{org.name} wants to talk to you" + (f" about {job.title}" if job else ""), f"""
        <h2 class="title">{_esc(org.name)} found your profile</h2>
        <p class="description">Hi {_esc(p.full_name.split()[0])}, <strong>{_esc(org.name)}</strong> found you on
        the Hybent Talent Network and would like to talk to you{role}.</p>{note}
        <p class="description">If you say yes, they get your name, email, phone and profile. If you say no, they get nothing.</p>
        <div class="button-wrap"><a href="{yes}" class="button">Yes, share my details</a></div>
        <p class="description" style="text-align:center"><a href="{no}">No thanks</a> &middot;
        <a href="{_url('/talent/manage/' + p.manage_token)}">Hide or delete my profile</a></p>""")
    return req


async def by_request_token(db: AsyncSession, token: str) -> TalentContactRequest | None:
    return (await db.execute(select(TalentContactRequest).where(TalentContactRequest.token == token))).scalar_one_or_none()


async def request_summary(db: AsyncSession, req: TalentContactRequest) -> dict:
    org = (await db.execute(select(Organization).where(Organization.id == req.organization_id))).scalar_one()
    job = None
    if req.job_id:
        job = (await db.execute(select(Job).where(Job.id == req.job_id))).scalar_one_or_none()
    return {"company": org.name, "company_logo": org.logo_url, "job_title": job.title if job else None,
            "message": req.message, "status": req.status}


async def respond(db: AsyncSession, req: TalentContactRequest, accept: bool) -> None:
    """Records the answer. On yes the member becomes a Candidate of that company
    (with contact details) and, if the request named a job, joins its pipeline."""
    if req.status != "pending":
        return
    req.status = "accepted" if accept else "declined"
    req.responded_at = _now()
    p = (await db.execute(select(TalentProfile).where(TalentProfile.id == req.profile_id))).scalar_one()
    requester = (await db.execute(select(User).where(User.id == req.requested_by_id))).scalar_one_or_none() \
        if req.requested_by_id else None

    if accept:
        cand = (await db.execute(select(Candidate).where(
            Candidate.organization_id == req.organization_id, func.lower(Candidate.email) == p.email.lower(),
            Candidate.is_deleted.is_(False),
        ).limit(1))).scalar_one_or_none()
        if cand is None:
            cand = Candidate(
                organization_id=req.organization_id, created_by_id=req.requested_by_id, email=p.email,
                full_name=p.full_name, phone=p.phone, location=p.location, current_title=p.current_title,
                current_company=p.current_company, years_experience=p.years_experience,
                skills=list(p.skills or []), summary=p.summary, linkedin_url=p.linkedin_url, source=SOURCE,
                parsed_data={**(p.parsed_data or {}), "talent_profile_id": str(p.id)},
            )
            db.add(cand)
            await db.flush()
        req.candidate_id = cand.id
        if req.job_id:
            dup = (await db.execute(select(Application).where(
                Application.candidate_id == cand.id, Application.job_id == req.job_id))).scalar_one_or_none()
            if not dup:
                db.add(Application(organization_id=req.organization_id, job_id=req.job_id,
                                   candidate_id=cand.id, source=SOURCE))
                cand.pipeline_stage = cand.pipeline_stage or "applied"
    await db.flush()

    if requester and requester.email:
        verdict = "said yes" if accept else "said no"
        body = (f"<p class=\"description\"><strong>{_esc(p.full_name)}</strong> accepted. They are now in your "
                f"candidates with their email and phone.</p><div class=\"button-wrap\"><a href=\"{_url('/hiring')}\" "
                f"class=\"button\">Open Hybent</a></div>") if accept else (
                f"<p class=\"description\">{_esc(short_name(p.full_name))} from the Hybent Talent Network "
                f"chose not to share their details.</p>")
        _send(requester.email, f"Talent Network: {short_name(p.full_name)} {verdict}",
              f'<h2 class="title">Candidate {verdict}</h2>{body}')
