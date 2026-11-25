"""Who is messaging Hybent's WhatsApp number?

Only proven links count:
- client:    the contact was linked to a Hybent user by an email code.
- candidate: linked to a candidate email by an email code, or the number was
             verified with the WhatsApp OTP in the candidate portal.
- lead:      gave company details to the bot.
- visitor:   nothing known.
A number that merely matches a phone on a resume or profile proves nothing,
so it never unlocks anyone's data.
"""

from dataclasses import dataclass, field

from sqlalchemy import func, or_, select

from app.models.candidate import Candidate
from app.models.organization import Organization
from app.models.user import User
from app.models.whatsapp import WaContactKind, WhatsAppContact
from app.utils.permissions import UserRole


@dataclass
class Identity:
    kind: str
    name: str | None = None
    user_id: str | None = None
    organization_name: str | None = None
    role: str | None = None
    candidate_ids: list[str] = field(default_factory=list)
    companies: list[str] = field(default_factory=list)


def _phone_digits(contact: WhatsAppContact) -> str:
    return "".join(ch for ch in (contact.phone or contact.wa_id or "") if ch.isdigit())


async def _candidates(db, contact: WhatsAppContact) -> list[Candidate]:
    conds = []
    if contact.candidate_email:
        conds.append(func.lower(Candidate.email) == contact.candidate_email.lower())
    digits = _phone_digits(contact)
    if len(digits) >= 10:
        # Portal-verified number (WhatsApp OTP); stored formatted, so compare digits.
        conds.append((Candidate.phone_verified_at.isnot(None))
                     & (func.regexp_replace(Candidate.phone, r"\D", "", "g") == digits))
    if not conds:
        return []
    return list((await db.execute(select(Candidate).where(or_(*conds)))).scalars())


async def identify(db, contact: WhatsAppContact) -> Identity:
    if contact.user_id:
        user = await db.get(User, contact.user_id)
        if user and user.is_active:
            org = await db.get(Organization, user.organization_id) if user.organization_id else None
            return Identity(kind=WaContactKind.CLIENT, name=user.full_name, user_id=str(user.id),
                            organization_name=org.name if org else None, role=str(user.role.value if hasattr(user.role, "value") else user.role))

    cands = await _candidates(db, contact)
    if cands:
        if contact.kind != WaContactKind.CANDIDATE:
            contact.kind = WaContactKind.CANDIDATE
        org_ids = {c.organization_id for c in cands}
        orgs = list((await db.execute(select(Organization.name).where(Organization.id.in_(org_ids)))).scalars())
        return Identity(kind=WaContactKind.CANDIDATE, name=cands[0].full_name,
                        candidate_ids=[str(c.id) for c in cands], companies=orgs)

    name = (contact.lead or {}).get("name")
    kind = WaContactKind.LEAD if contact.kind == WaContactKind.LEAD else WaContactKind.VISITOR
    return Identity(kind=kind, name=name)


async def find_account_by_email(db, email: str) -> dict | None:
    """The Hybent account an email belongs to: a staff user first, else a candidate."""
    email = email.strip().lower()
    user = (await db.execute(
        select(User).where(func.lower(User.email) == email, User.is_active.is_(True), User.role != UserRole.CANDIDATE)
    )).scalars().first()
    if user:
        return {"kind": WaContactKind.CLIENT, "user_id": str(user.id)}
    cand = (await db.execute(select(Candidate.id).where(func.lower(Candidate.email) == email).limit(1))).scalar()
    if cand:
        return {"kind": WaContactKind.CANDIDATE}
    return None


# ── What a verified candidate may see ─────────────────────────────────────
# Only their own applications and interviews, in plain words. Never the AI
# score, recruiter notes, rejection reason, feedback or other candidates.

_ROUNDS = {
    "screening": "Screening", "pre_screening": "Pre-screening", "technical_round": "Technical round",
    "practical_round": "Practical round", "techno_functional": "Techno-functional round",
    "techno_functional_round": "Techno-functional round", "management_round": "Management round",
    "hr_round": "HR round",
}


def stage_label(stage: str | None) -> str:
    """An application stage as the candidate should hear it."""
    s = (stage or "applied").lower()
    if s in ("hired", "hired_joined"):
        return "Hired 🎉"
    if s.endswith("_rejected") or s.endswith("_back_out") or s in ("rejected", "offer_withdrawn"):
        return "Closed (not moving ahead this time)"
    if s in ("offer", "offered"):
        return "Offer stage"
    if s == "interviewed":
        return "Interview done, waiting for the company's decision"
    if s == "interview":
        return "Interview stage"
    if s in ("applied", "screening", "pre_screening"):
        return "Under review"
    if s in ("screening_selected", "pre_screening_selected"):
        return "Shortlisted"
    if s.endswith("_selected"):
        base = s[: -len("_selected")]
        return f"Cleared {_ROUNDS.get(base, base.replace('_', ' '))}, next step coming"
    return f"In {_ROUNDS.get(s, s.replace('_', ' '))}"


async def candidate_context(db, candidate_ids: list[str]) -> dict:
    """Applications and upcoming interviews for these candidate records.
    Interviews get short refs (I1, I2…) the bot uses for reschedule requests."""
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo

    from app.models.application import Application
    from app.models.interview import Interview
    from app.models.job import Job
    from app.utils.permissions import InterviewStatus

    if not candidate_ids:
        return {"applications": [], "interviews": []}
    import uuid as _uuid
    ids = [_uuid.UUID(i) for i in candidate_ids]
    rows = (await db.execute(
        select(Application, Job.title, Organization.name)
        .join(Job, Job.id == Application.job_id)
        .join(Organization, Organization.id == Application.organization_id)
        .where(Application.candidate_id.in_(ids))
        .order_by(Application.applied_at.desc()).limit(10)
    )).all()
    apps = [{"job": title, "company": org, "status": stage_label(a.stage),
             "applied_on": a.applied_at.strftime("%d %b %Y") if a.applied_at else None}
            for a, title, org in rows]

    now = datetime.now(timezone.utc)
    ivs = (await db.execute(
        select(Interview, Organization.name, Organization.timezone)
        .join(Organization, Organization.id == Interview.organization_id)
        .where(Interview.candidate_id.in_(ids), Interview.status == InterviewStatus.SCHEDULED,
               Interview.scheduled_at > now - timedelta(hours=1))
        .order_by(Interview.scheduled_at).limit(5)
    )).all()
    interviews = []
    for n, (iv, org, tz) in enumerate(ivs, start=1):
        try:
            zone = ZoneInfo(tz or "Asia/Kolkata")
        except Exception:
            zone = ZoneInfo("Asia/Kolkata")
        interviews.append({
            "ref": f"I{n}", "id": str(iv.id), "organization_id": str(iv.organization_id),
            "title": iv.title, "company": org,
            "when": iv.scheduled_at.astimezone(zone).strftime("%a %d %b %Y, %I:%M %p") + f" ({zone.key})",
            "duration_minutes": iv.duration_minutes, "type": str(iv.interview_type),
            "join": iv.meeting_link or iv.location or "details will be shared by email",
        })
    return {"applications": apps, "interviews": interviews}


# ── What a verified client (admin / recruiter / interviewer) may see ─────
# A small, read-only slice of their own company, scoped like the app: admins
# see the whole company; recruiters and interviewers see interviews they are
# on and applicants for jobs they created. Anything bigger: the app's Copilot.

async def client_context(db, user_id: str) -> dict:
    import uuid as _uuid
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo

    from sqlalchemy import and_, func as _f

    from app.models.application import Application
    from app.models.interview import Interview, InterviewPanelist
    from app.models.job import Job
    from app.utils.permissions import InterviewStatus

    user = await db.get(User, _uuid.UUID(user_id))
    org = await db.get(Organization, user.organization_id)
    try:
        zone = ZoneInfo(org.timezone or "Asia/Kolkata")
    except Exception:
        zone = ZoneInfo("Asia/Kolkata")
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    is_admin = role == "admin"
    now = datetime.now(timezone.utc)
    local_today = now.astimezone(zone).replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = local_today + timedelta(days=2)

    iq = (select(Interview, Candidate.full_name, Job.title)
          .join(Candidate, Candidate.id == Interview.candidate_id)
          .outerjoin(Application, Application.id == Interview.application_id)
          .outerjoin(Job, Job.id == Application.job_id)
          .where(Interview.organization_id == org.id, Interview.status == InterviewStatus.SCHEDULED,
                 Interview.scheduled_at >= local_today, Interview.scheduled_at < window_end)
          .order_by(Interview.scheduled_at).limit(15))
    if not is_admin:
        on_panel = select(InterviewPanelist.interview_id).where(InterviewPanelist.user_id == user.id)
        iq = iq.where((Interview.scheduled_by_id == user.id) | Interview.id.in_(on_panel))
    interviews = [{
        "when": iv.scheduled_at.astimezone(zone).strftime("%a %d %b, %I:%M %p"),
        "candidate": name, "job": title or iv.title, "title": iv.title,
        "join": iv.meeting_link or iv.location or "",
    } for iv, name, title in (await db.execute(iq)).all()]

    since = now - timedelta(hours=24)
    aq = (select(Candidate.full_name, Job.title, Application.stage)
          .join(Candidate, Candidate.id == Application.candidate_id)
          .join(Job, Job.id == Application.job_id)
          .where(Application.organization_id == org.id, Application.applied_at >= since)
          .order_by(Application.applied_at.desc()))
    if not is_admin:
        aq = aq.where(Job.created_by_id == user.id)
    new_apps = (await db.execute(aq.limit(10))).all()

    jq = (select(Job.title, _f.count(Application.id))
          .outerjoin(Application, and_(Application.job_id == Job.id))
          .where(Job.organization_id == org.id, Job.status == "active", Job.is_deleted.is_(False))
          .group_by(Job.id, Job.title).order_by(_f.count(Application.id).desc()).limit(10))
    if not is_admin:
        jq = jq.where(Job.created_by_id == user.id)
    jobs = [{"job": t, "applicants": n} for t, n in (await db.execute(jq)).all()]

    return {
        "today": local_today.strftime("%a %d %b %Y") + f" ({zone.key})",
        "scope": "whole company" if is_admin else "their own jobs and interviews",
        "interviews_today_and_tomorrow": interviews,
        "new_applicants_last_24h": [{"candidate": n, "job": t, "stage": stage_label(s)} for n, t, s in new_apps],
        "open_jobs": jobs,
    }
