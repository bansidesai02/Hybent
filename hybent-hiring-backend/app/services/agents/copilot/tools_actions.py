"""
More write tools for the Copilot agent: tag/shortlist, email, reschedule and
cancel. Like send_pre_screening_invite, each one calls the same router
function the app's own button uses, so permissions, validation, activity
logs, reminders and notification emails stay identical.

All of them pause for the recruiter's approval before the handler runs.
"""
import json
import re
import uuid
import zoneinfo
from typing import Optional

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select, text

from app.services.agents.registry import ToolContext, ToolResult, params
from app.services.agents.copilot.toolset import REGISTRY
from app.services.agents.copilot.tools_candidate import resolve_candidate
from app.services.agents.copilot.tools_write import (
    WRITE_ROLES, _TIME_HINT, _needs_real_candidate, _prepare_candidate,
)
from app.services.ai import copilot_service as legacy

_S = {"type": "string"}


def _not_permitted(ctx: ToolContext) -> Optional[ToolResult]:
    if (ctx.user_role or "").lower() not in WRITE_ROLES:
        return ToolResult(data={"error": "Not permitted for this user."}, summary="Not permitted", ok=False)
    return None


def _failed(detail: str) -> ToolResult:
    return ToolResult(data={"error": detail}, summary="Didn't go through", ok=False)


async def _user(ctx: ToolContext):
    from app.models.user import User

    return (await ctx.db.execute(select(User).where(User.id == uuid.UUID(ctx.user_id)))).scalar_one()


async def _response_error(resp) -> Optional[str]:
    """Router functions return an ORJSONResponse; anything but 2xx is a failure."""
    status = getattr(resp, "status_code", 200)
    if 200 <= status < 300:
        return None
    try:
        return json.loads(resp.body).get("message") or f"Failed ({status})"
    except Exception:
        return f"Failed ({status})"


async def _next_interview(ctx: ToolContext, candidate_id) -> Optional[object]:
    """The candidate's next scheduled interview (soonest upcoming, else latest)."""
    return (await ctx.db.execute(
        text(
            "SELECT id, title, scheduled_at FROM interviews"
            " WHERE organization_id = :o AND candidate_id = :c AND status = 'scheduled'"
            " ORDER BY (scheduled_at < now()), scheduled_at LIMIT 1"
        ),
        {"o": ctx.organization_id, "c": candidate_id},
    )).fetchone()


async def _org_tz(ctx: ToolContext) -> zoneinfo.ZoneInfo:
    row = (await ctx.db.execute(
        text("SELECT timezone FROM organizations WHERE id = :o"), {"o": ctx.organization_id},
    )).fetchone()
    try:
        return zoneinfo.ZoneInfo((row and row[0]) or "Asia/Kolkata")
    except Exception:
        return zoneinfo.ZoneInfo("Asia/Kolkata")


# ── Tag / shortlist ──────────────────────────────────────────────────────────

def _validate_tag(args: dict) -> Optional[str]:
    if not str(args.get("tag") or "").strip():
        return "No tag given. Ask the recruiter which tag (e.g. shortlisted)."
    return _needs_real_candidate(args)


@REGISTRY.tool(
    "tag_candidate",
    "Add a tag to a candidate. Shortlisting = tag 'shortlisted'. Use for 'shortlist X', 'tag X as Y', 'X ko shortlist karo'.",
    params({"candidate_id": _S, "candidate_name": _S, "tag": {"type": "string", "description": "e.g. shortlisted"}},
           required=["candidate_name", "tag"]),
    kind="write",
    status="Tagging candidate", status_args=("candidate_name", "tag"),
    validate=_validate_tag, prepare=_prepare_candidate,
)
async def tag_candidate(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.talent_pool import add_tag

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    tag = str(args["tag"]).strip().lower()
    try:
        resp = await add_tag(candidate_id=uuid.UUID(str(c["id"])), tag=tag, current_user=await _user(ctx), db=ctx.db)
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    legacy._COPILOT_CACHE.clear()
    return ToolResult(
        data={"candidate": c["full_name"], "tag_added": tag},
        summary=f"Tagged {tag}",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )


# ── Email a candidate ────────────────────────────────────────────────────────

def _validate_email(args: dict) -> Optional[str]:
    if not str(args.get("subject") or "").strip() or not str(args.get("body") or "").strip():
        return "Subject or message is missing. Draft both from what the recruiter asked, then call again."
    return _needs_real_candidate(args)


def settings_link(ctx: ToolContext) -> str:
    base = "/hiring/admin" if (ctx.user_role or "").lower() == "admin" else "/hiring/recruiter"
    return f"{base}/settings"


def _gmail_problem(ctx: ToolContext, detail: str) -> str:
    return (
        f"{detail} Tell the recruiter to connect Gmail under Email accounts on the Settings page, and include this "
        f"exact Markdown link: [Open Settings]({settings_link(ctx)}). Don't suggest reconnecting Gmail as a "
        "[SUGGEST] option; you can't do it from chat."
    )


async def _gmail_ready(ctx: ToolContext) -> Optional[str]:
    """None if the recruiter has a connected Gmail to send from, else why not."""
    from app.models.email_account import EmailAccountProvider, EmailAccountStatus
    from app.routers.inbox import _resolve_inbox_account

    account = await _resolve_inbox_account(ctx.db, await _user(ctx))
    if account is None:
        return _gmail_problem(ctx, "No Gmail is connected, so the email can't be sent.")
    if account.provider != EmailAccountProvider.GMAIL:
        return _gmail_problem(ctx, "Sending from Copilot needs a Gmail mailbox; the connected one isn't Gmail.")
    if account.status != EmailAccountStatus.CONNECTED:
        return _gmail_problem(ctx, f"The Gmail {account.email_address} needs to be reconnected.")
    return None


async def _prepare_email(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    # Checked before the approval card, so the recruiter never approves an
    # email that can't go out.
    if problem := await _gmail_ready(ctx):
        return args, problem
    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        # "Email Bansi" often means a colleague, not a candidate.
        member, _ = await _resolve_team_member(str(args.get("candidate_name") or ""), ctx)
        if member is not None:
            return args, (
                f"{member.full_name} is a team member, not a candidate. Call email_team_member with "
                f"recipient_name '{member.full_name}' and the same subject and body instead."
            )
        return args, problem
    c, _ = await resolve_candidate(args, ctx)
    if not (c or {}).get("email"):
        return args, f"{args['candidate_name']} has no email address on file."
    # Shown on the approval card, so the recruiter sees exactly who gets it.
    return {**args, "to": c["email"]}, None


@REGISTRY.tool(
    "email_candidate",
    "Send an email to a candidate from the recruiter's connected Gmail. Draft a short professional subject and body "
    "from what the recruiter asked (their language/tone; sign off with no name placeholder). The recruiter sees and approves it first.",
    params({"candidate_id": _S, "candidate_name": _S, "subject": _S, "body": _S},
           required=["candidate_name", "subject", "body"]),
    kind="write",
    status="Emailing candidate", status_args=("candidate_name",),
    validate=_validate_email, prepare=_prepare_email,
)
async def email_candidate(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.inbox import SendEmail, send_email

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    if not c.get("email"):
        return _failed(f"{c['full_name']} has no email address on file.")
    try:
        resp = await send_email(
            body=SendEmail(to=[c["email"]], subject=args["subject"], body=args["body"]),
            db=ctx.db, current_user=await _user(ctx),
        )
    except HTTPException as exc:
        detail = str(exc.detail)
        if "gmail" in detail.lower() or "mailbox" in detail.lower():
            detail = _gmail_problem(ctx, detail)
        return _failed(detail)
    if err := await _response_error(resp):
        return _failed(err)
    return ToolResult(
        data={"sent_to": c["email"], "candidate": c["full_name"], "subject": args["subject"]},
        summary="Email sent",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )


# ── Reschedule / cancel an interview ─────────────────────────────────────────

def _validate_reschedule(args: dict) -> Optional[str]:
    if not str(args.get("new_time") or "").strip():
        return "The new date and time are missing. Ask the recruiter when to move it to."
    return _needs_real_candidate(args)


async def _prepare_interview(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        return args, problem
    c, _ = await resolve_candidate(args, ctx)
    iv = await _next_interview(ctx, c["id"])
    if not iv:
        return args, f"{c['full_name']} has no scheduled interview."
    when = iv.scheduled_at.astimezone(await _org_tz(ctx)).strftime("%a, %b %d, %I:%M %p")
    return {**args, "interview": f"{iv.title} ({when})"}, None


async def _prepare_reschedule(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    if ctx.recruiter_text and not _TIME_HINT.search(ctx.recruiter_text):
        return args, "The recruiter hasn't said the new time. Ask for it; don't pick one."
    return await _prepare_interview(args, ctx)


@REGISTRY.tool(
    "reschedule_interview",
    "Move a candidate's scheduled interview to a new date/time the recruiter gave. Panel and candidate get the usual update email.",
    params({"candidate_id": _S, "candidate_name": _S,
            "new_time": {"type": "string", "description": "YYYY-MM-DD HH:MM"}},
           required=["candidate_name", "new_time"]),
    kind="write",
    status="Rescheduling interview", status_args=("candidate_name", "new_time"),
    validate=_validate_reschedule, prepare=_prepare_reschedule,
)
async def reschedule_interview(args: dict, ctx: ToolContext) -> ToolResult:
    from dateutil.parser import parse as parse_date

    from app.routers.interviews import update_interview
    from app.schemas.interview import InterviewUpdate

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    iv = await _next_interview(ctx, c["id"])
    if not iv:
        return _failed(f"{c['full_name']} has no scheduled interview.")
    tz = await _org_tz(ctx)
    try:
        dt = parse_date(str(args["new_time"]))
    except (ValueError, OverflowError):
        return _failed(f"Couldn't read the time '{args['new_time']}'.")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=tz)
    try:
        resp = await update_interview(
            interview_id=iv.id, data=InterviewUpdate(scheduled_at=dt), current_user=await _user(ctx),
            db=ctx.db, background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    legacy._COPILOT_CACHE.clear()
    return ToolResult(
        data={"candidate": c["full_name"], "interview": iv.title,
              "new_time": dt.astimezone(tz).strftime("%a, %b %d, %I:%M %p")},
        summary="Rescheduled",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )


@REGISTRY.tool(
    "cancel_interview",
    "Cancel a candidate's scheduled interview. Panel and candidate are emailed about it.",
    params({"candidate_id": _S, "candidate_name": _S, "reason": _S}, required=["candidate_name"]),
    kind="write",
    status="Cancelling interview", status_args=("candidate_name",),
    validate=_needs_real_candidate, prepare=_prepare_interview,
)
async def cancel_interview(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.interviews import cancel_interview as cancel_route

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    iv = await _next_interview(ctx, c["id"])
    if not iv:
        return _failed(f"{c['full_name']} has no scheduled interview.")
    try:
        resp = await cancel_route(
            interview_id=iv.id, current_user=await _user(ctx), db=ctx.db,
            background_tasks=ctx.background_tasks or BackgroundTasks(), reason=args.get("reason"),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    legacy._COPILOT_CACHE.clear()
    return ToolResult(
        data={"candidate": c["full_name"], "cancelled": iv.title},
        summary="Cancelled",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )


# ── Email a team member ──────────────────────────────────────────────────────

def _validate_team_email(args: dict) -> Optional[str]:
    if not str(args.get("recipient_name") or "").strip():
        return "Which team member? Ask the recruiter for a name."
    if not str(args.get("subject") or "").strip() or not str(args.get("body") or "").strip():
        return "Subject or message is missing. Draft both from what the recruiter asked, then call again."
    return None


async def _resolve_team_member(name: str, ctx: ToolContext) -> tuple[Optional[object], Optional[str]]:
    rows = (await ctx.db.execute(
        text(
            "SELECT full_name, email FROM users WHERE organization_id = :o AND role <> 'candidate'"
            " AND (full_name ILIKE :n OR email ILIKE :n)"
        ),
        {"o": ctx.organization_id, "n": f"%{name.strip()}%"},
    )).fetchall()
    rows = legacy._prefer_exact(rows, name)
    if not rows:
        return None, f"No team member called '{name}'. If they are a candidate, use email_candidate instead."
    if len(rows) > 1:
        return None, f"'{name}' matches several team members: {', '.join(r.full_name for r in rows)}. Ask which one."
    return rows[0], None


async def _prepare_team_email(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    if problem := await _gmail_ready(ctx):
        return args, problem
    member, problem = await _resolve_team_member(str(args["recipient_name"]), ctx)
    if problem:
        return args, problem
    return {**args, "recipient_name": member.full_name, "to": member.email}, None


@REGISTRY.tool(
    "email_team_member",
    "Send an email to a member of the recruiter's own team (interviewer, recruiter, admin; see TEAM_MEMBERS) from "
    "the recruiter's connected Gmail, e.g. to ask about interview availability. For candidates use email_candidate. "
    "Draft a short subject and body from what the recruiter asked. The recruiter approves it first.",
    params({"recipient_name": _S, "subject": _S, "body": _S}, required=["recipient_name", "subject", "body"]),
    kind="write",
    status="Emailing team member", status_args=("recipient_name",),
    validate=_validate_team_email, prepare=_prepare_team_email,
)
async def email_team_member(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.inbox import SendEmail, send_email

    if denied := _not_permitted(ctx):
        return denied
    member, problem = await _resolve_team_member(str(args["recipient_name"]), ctx)
    if problem:
        return _failed(problem)
    try:
        resp = await send_email(
            body=SendEmail(to=[member.email], subject=args["subject"], body=args["body"]),
            db=ctx.db, current_user=await _user(ctx),
        )
    except HTTPException as exc:
        detail = str(exc.detail)
        if "gmail" in detail.lower() or "mailbox" in detail.lower():
            detail = _gmail_problem(ctx, detail)
        return _failed(detail)
    if err := await _response_error(resp):
        return _failed(err)
    return ToolResult(
        data={"sent_to": member.email, "team_member": member.full_name, "subject": args["subject"]},
        summary="Email sent",
    )


# ── Job status ───────────────────────────────────────────────────────────────

_JOB_STATUSES = ("active", "paused", "closed", "draft")


def _validate_job_status(args: dict) -> Optional[str]:
    if not str(args.get("job_title") or "").strip():
        return "Which job? Ask the recruiter for the job title."
    if str(args.get("new_status") or "").lower() not in _JOB_STATUSES:
        return f"Status must be one of: {', '.join(_JOB_STATUSES)}."
    return None


async def _find_job(args: dict, ctx: ToolContext) -> tuple[Optional[object], Optional[str]]:
    title = str(args["job_title"]).strip()
    rows = (await ctx.db.execute(
        text(
            "SELECT id, title, status FROM jobs WHERE organization_id = :o AND title ILIKE :t"
            " AND status <> 'pool' ORDER BY created_at DESC LIMIT 5"
        ),
        {"o": ctx.organization_id, "t": f"%{title}%"},
    )).fetchall()
    if not rows:
        return None, f"No job matching '{title}'."
    exact = [r for r in rows if r.title.strip().lower() == title.lower()]
    if len(rows) > 1 and len(exact) != 1:
        return None, "Several jobs match: " + ", ".join(f"{r.title} ({r.status})" for r in rows) + ". Ask which one."
    return (exact or rows)[0], None


async def _prepare_job_status(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    if (ctx.user_role or "").lower() != "admin":
        return args, "Only admins can change a job's status. Tell the recruiter to ask an admin."
    job, problem = await _find_job(args, ctx)
    if problem:
        return args, problem
    new = str(args["new_status"]).lower()
    if str(job.status).lower() == new:
        return args, f"'{job.title}' is already {new}."
    return {**args, "job_title": job.title, "new_status": new, "current_status": str(job.status)}, None


@REGISTRY.tool(
    "update_job_status",
    "Change a job opening's status: active (open/reopen), paused (on hold), closed, or draft. Admins only.",
    params({"job_title": _S, "new_status": {"type": "string", "enum": list(_JOB_STATUSES)}},
           required=["job_title", "new_status"]),
    kind="write",
    status="Updating job", status_args=("job_title", "new_status"),
    validate=_validate_job_status, prepare=_prepare_job_status,
)
async def update_job_status(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.jobs import update_job
    from app.schemas.job import JobUpdate

    if (ctx.user_role or "").lower() != "admin":
        return _failed("Only admins can change a job's status.")
    job, problem = await _find_job(args, ctx)
    if problem:
        return _failed(problem)
    new = str(args["new_status"]).lower()
    try:
        resp = await update_job(
            job_id=job.id, data=JobUpdate(status=new), current_user=await _user(ctx),
            db=ctx.db, background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    legacy._COPILOT_CACHE.clear()
    return ToolResult(data={"job": job.title, "status": new}, summary="Job updated",
                      focus={"job_id": str(job.id), "job_title": job.title})


# ── Candidate details ────────────────────────────────────────────────────────

# Plain profile facts the recruiter can change from chat. Stage, tags and
# email have their own tools (or need more care).
_CANDIDATE_FIELDS = (
    "phone", "location", "notice_period_days", "current_ctc", "expected_ctc", "current_company",
    "current_title", "years_experience", "work_mode_preference", "linkedin_url", "hr_notes",
)


def _candidate_changes(args: dict) -> dict:
    return {k: args[k] for k in _CANDIDATE_FIELDS if str(args.get(k) or "").strip()}


def _validate_candidate_update(args: dict) -> Optional[str]:
    if missing := _needs_real_candidate(args):
        return missing
    changes = _candidate_changes(args)
    if not changes:
        return "Nothing to change. Ask the recruiter which detail to update and to what."
    if "years_experience" in changes:
        try:
            float(changes["years_experience"])
        except (TypeError, ValueError):
            return "years_experience must be a number."
    return None


@REGISTRY.tool(
    "update_candidate_details",
    "Update a candidate's profile facts: phone, location, notice period (days), current/expected CTC, current "
    "company/title, years of experience, work mode preference, LinkedIn, HR notes. Only set fields the recruiter gave.",
    params({
        "candidate_id": _S, "candidate_name": _S,
        "phone": _S, "location": _S, "notice_period_days": _S, "current_ctc": _S, "expected_ctc": _S,
        "current_company": _S, "current_title": _S, "years_experience": {"type": "number"},
        "work_mode_preference": {"type": "string", "description": "remote, hybrid or onsite"},
        "linkedin_url": _S, "hr_notes": {"type": "string", "description": "Replaces the HR notes"},
    }, required=["candidate_name"]),
    kind="write",
    status="Updating candidate", status_args=("candidate_name",),
    validate=_validate_candidate_update, prepare=_prepare_candidate,
)
async def update_candidate_details(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.candidates import update_candidate
    from app.schemas.candidate import CandidateUpdate

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    changes = _candidate_changes(args)
    if "years_experience" in changes:
        changes["years_experience"] = float(changes["years_experience"])
    for k in ("notice_period_days", "current_ctc", "expected_ctc"):
        if k in changes:
            changes[k] = str(changes[k])
    try:
        resp = await update_candidate(
            candidate_id=uuid.UUID(str(c["id"])), data=CandidateUpdate(**changes), current_user=await _user(ctx),
            db=ctx.db, background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    legacy._COPILOT_CACHE.clear()
    return ToolResult(
        data={"candidate": c["full_name"], "updated": changes},
        summary="Profile updated",
        focus={"candidate_id": str(c["id"]), "candidate_name": c["full_name"]},
    )


def _focus(c: dict) -> dict:
    return {"candidate_id": str(c["id"]), "candidate_name": c["full_name"]}


# ── Reject (with the rejection email) ────────────────────────────────────────

@REGISTRY.tool(
    "reject_candidate",
    "Reject a candidate and email them the standard polite rejection (send_email=false to skip the email). "
    "Candidates who opted in to WhatsApp also get the usual 'not selected' message.",
    params({"candidate_id": _S, "candidate_name": _S, "send_email": {"type": "boolean"}}, required=["candidate_name"]),
    kind="write",
    status="Rejecting candidate", status_args=("candidate_name",),
    validate=_needs_real_candidate, prepare=_prepare_candidate,
)
async def reject_candidate(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.candidates import update_candidate_stage
    from app.schemas.candidate import CandidateStageUpdate

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    send_email = args.get("send_email") is not False
    try:
        resp = await update_candidate_stage(
            candidate_id=uuid.UUID(str(c["id"])),
            data=CandidateStageUpdate(pipeline_stage="rejected", send_rejection_email=send_email),
            current_user=await _user(ctx), db=ctx.db,
            background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    await ctx.db.commit()
    legacy._COPILOT_CACHE.clear()
    return ToolResult(data={"candidate": c["full_name"], "rejected": True, "rejection_email": send_email},
                      summary="Rejected", focus=_focus(c))


# ── Offers ───────────────────────────────────────────────────────────────────

async def _application(ctx: ToolContext, candidate_id, job_title: Optional[str]) -> tuple[Optional[object], Optional[str]]:
    """The candidate's application to offer against (for `job_title` if given)."""
    rows = (await ctx.db.execute(
        text(
            "SELECT a.id, j.title FROM applications a JOIN jobs j ON j.id = a.job_id"
            " WHERE a.organization_id = :o AND a.candidate_id = :c"
            + (" AND j.title ILIKE :t" if job_title else "")
            + " ORDER BY a.created_at DESC LIMIT 5"
        ),
        {"o": ctx.organization_id, "c": candidate_id, **({"t": f"%{job_title.strip()}%"} if job_title else {})},
    )).fetchall()
    if not rows:
        return None, ("They haven't applied to a job matching that title." if job_title
                      else "They haven't applied to any job, and an offer needs one. Ask which job.")
    if len(rows) > 1:
        return None, "They applied to several jobs: " + ", ".join(r.title for r in rows) + ". Ask which one the offer is for."
    return rows[0], None


def _validate_offer(args: dict) -> Optional[str]:
    if missing := _needs_real_candidate(args):
        return missing
    try:
        if float(args.get("base_salary") or 0) <= 0:
            return "The salary is missing. Ask the recruiter for the annual base salary."
    except (TypeError, ValueError):
        return "base_salary must be a number (annual, e.g. 1200000 for 12 LPA)."
    return None


async def _prepare_offer(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        return args, problem
    c, _ = await resolve_candidate(args, ctx)
    application, problem = await _application(ctx, c["id"], args.get("job_title"))
    if problem:
        return args, f"{c['full_name']}: {problem}"
    existing = (await ctx.db.execute(
        text("SELECT status FROM offers WHERE application_id = :a"), {"a": application.id},
    )).fetchone()
    if existing:
        return args, f"{c['full_name']} already has an offer ({existing.status}) for {application.title}. Use send_offer to send it."
    return {**args, "job_title": application.title, "position_title": args.get("position_title") or application.title}, None


@REGISTRY.tool(
    "create_offer",
    "Create a draft offer for a candidate's job application. base_salary is ANNUAL in salary_currency "
    "(12 LPA = 1200000 INR). Dates as YYYY-MM-DD. Doesn't send it; use send_offer for that.",
    params({
        "candidate_id": _S, "candidate_name": _S, "job_title": _S, "position_title": _S,
        "base_salary": {"type": "number"}, "salary_currency": {"type": "string", "description": "Default INR"},
        "bonus": {"type": "number"}, "benefits": _S, "start_date": _S, "expiry_date": _S,
    }, required=["candidate_name", "base_salary"]),
    kind="write",
    status="Creating offer", status_args=("candidate_name", "job_title"),
    validate=_validate_offer, prepare=_prepare_offer,
)
async def create_offer(args: dict, ctx: ToolContext) -> ToolResult:
    from dateutil.parser import parse as parse_date

    from app.routers.offers import create_offer as create_route
    from app.schemas.offer import OfferCreate

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    application, problem = await _application(ctx, c["id"], args.get("job_title"))
    if problem:
        return _failed(problem)
    dates = {}
    for k in ("start_date", "expiry_date"):
        if args.get(k):
            try:
                dates[k] = parse_date(str(args[k]))
            except (ValueError, OverflowError):
                return _failed(f"Couldn't read the {k.replace('_', ' ')} '{args[k]}'.")
    try:
        resp = await create_route(
            data=OfferCreate(
                application_id=str(application.id),
                position_title=args.get("position_title") or application.title,
                base_salary=float(args["base_salary"]),
                salary_currency=(args.get("salary_currency") or "INR").upper(),
                bonus=float(args["bonus"]) if args.get("bonus") else None,
                benefits=args.get("benefits"),
                **dates,
            ),
            current_user=await _user(ctx), db=ctx.db,
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    await ctx.db.commit()
    return ToolResult(
        data={"candidate": c["full_name"], "offer_for": application.title, "status": "draft",
              "base_salary": float(args["base_salary"]), "currency": (args.get("salary_currency") or "INR").upper()},
        summary="Offer drafted", focus=_focus(c),
    )


async def _latest_offer(ctx: ToolContext, candidate_id) -> Optional[object]:
    return (await ctx.db.execute(
        text(
            "SELECT o.id, o.status, o.position_title FROM offers o JOIN applications a ON a.id = o.application_id"
            " WHERE o.organization_id = :o AND a.candidate_id = :c ORDER BY o.created_at DESC LIMIT 1"
        ),
        {"o": ctx.organization_id, "c": candidate_id},
    )).fetchone()


async def _prepare_send_offer(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        return args, problem
    c, _ = await resolve_candidate(args, ctx)
    offer = await _latest_offer(ctx, c["id"])
    if not offer:
        # Fine if an earlier step of this plan creates it; it runs first.
        if any(p["name"] == "create_offer" and p["args"].get("candidate_name") == c["full_name"] for p in ctx.planned):
            return {**args, "offer": "the offer drafted in the step before"}, None
        return args, f"{c['full_name']} has no offer yet. Plan create_offer first (ask for the salary if not given)."
    if str(offer.status).lower() != "draft":
        return args, f"{c['full_name']}'s offer is already {offer.status}."
    return {**args, "offer": offer.position_title}, None


@REGISTRY.tool(
    "send_offer",
    "Send a candidate's draft offer: makes the offer-letter PDF and emails it to them. If you plan create_offer in "
    "the same request, plan this right after it.",
    params({"candidate_id": _S, "candidate_name": _S}, required=["candidate_name"]),
    kind="write",
    status="Sending offer", status_args=("candidate_name",),
    validate=_needs_real_candidate, prepare=_prepare_send_offer,
)
async def send_offer(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.offers import generate_pdf, send_offer as send_route

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    offer = await _latest_offer(ctx, c["id"])
    if not offer:
        return _failed(f"{c['full_name']} has no offer to send.")
    user = await _user(ctx)
    pdf_note = None
    try:
        # The email links to the PDF; without it the link would be a raw API URL.
        await generate_pdf(offer_id=offer.id, current_user=user, db=ctx.db)
        await ctx.db.commit()
    except Exception as exc:
        await ctx.db.rollback()
        pdf_note = f"Offer letter PDF couldn't be made ({str(exc)[:120]}); the email links to the offer page instead."
    try:
        resp = await send_route(offer_id=offer.id, current_user=user, db=ctx.db)
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    await ctx.db.commit()
    legacy._COPILOT_CACHE.clear()
    data = {"candidate": c["full_name"], "offer": offer.position_title, "sent_to": c.get("email"), "status": "sent"}
    if pdf_note:
        data["note"] = pdf_note
    return ToolResult(data=data, summary="Offer sent", focus=_focus(c))


# ── Add a candidate ──────────────────────────────────────────────────────────

def _validate_new_candidate(args: dict) -> Optional[str]:
    if not str(args.get("full_name") or "").strip():
        return "The candidate's full name is missing. Ask for it."
    email = str(args.get("email") or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return "A valid email is needed to add a candidate. Ask the recruiter for it."
    return None


@REGISTRY.tool(
    "add_candidate",
    "Add a new candidate to the Talent DB from details the recruiter gives (name and email required). "
    "To add them from a resume file, tell the recruiter to use Upload Resume.",
    params({"full_name": _S, "email": _S, "phone": _S, "location": _S, "linkedin_url": _S,
            "source": {"type": "string", "description": "e.g. referral, LinkedIn, walk-in"}},
           required=["full_name", "email"]),
    kind="write",
    status="Adding candidate", status_args=("full_name",),
    validate=_validate_new_candidate,
)
async def add_candidate(args: dict, ctx: ToolContext) -> ToolResult:
    from app.routers.candidates import create_candidate
    from app.schemas.candidate import CandidateCreate

    if denied := _not_permitted(ctx):
        return denied
    fields = {k: str(args[k]).strip() for k in ("full_name", "email", "phone", "location", "linkedin_url", "source")
              if str(args.get(k) or "").strip()}
    fields.setdefault("source", "copilot")
    try:
        resp = await create_candidate(
            data=CandidateCreate(**fields), current_user=await _user(ctx), db=ctx.db,
            background_tasks=ctx.background_tasks or BackgroundTasks(),
        )
    except HTTPException as exc:
        await ctx.db.rollback()
        return _failed(str(exc.detail))
    if err := await _response_error(resp):
        return _failed(err)
    await ctx.db.commit()
    legacy._COPILOT_CACHE.clear()
    try:
        new_id = json.loads(resp.body)["data"]["id"]
    except Exception:
        new_id = None
    return ToolResult(
        data={"added": fields["full_name"], "email": fields["email"]},
        summary="Candidate added",
        focus={"candidate_id": new_id, "candidate_name": fields["full_name"]} if new_id else {},
    )


# ── WhatsApp (approved templates only) ───────────────────────────────────────

# Recruiter-facing templates. Free text only reaches someone who messaged us
# in the last 24 hours, so Copilot sends Meta-approved templates.
_WA_TEMPLATES = ("shortlisted", "rejected", "application_received", "offer_sent")


def _validate_whatsapp(args: dict) -> Optional[str]:
    if str(args.get("template") or "") not in _WA_TEMPLATES:
        return f"Pick one of the approved WhatsApp messages: {', '.join(_WA_TEMPLATES)}."
    return _needs_real_candidate(args)


async def _prepare_whatsapp(args: dict, ctx: ToolContext) -> tuple[dict, Optional[str]]:
    from app.services import whatsapp_service
    from app.services.sms_service import EVENTS, msisdn

    if not whatsapp_service.configured():
        return args, "WhatsApp isn't set up on this server, so Copilot can't send WhatsApp messages."
    args, problem = await _prepare_candidate(args, ctx)
    if problem:
        return args, problem
    row = (await ctx.db.execute(
        text("SELECT phone, sms_opt_in FROM candidates WHERE organization_id = :o AND full_name = :n LIMIT 1"),
        {"o": ctx.organization_id, "n": args["candidate_name"]},
    )).fetchone()
    if not row or not msisdn(row.phone):
        return args, f"{args['candidate_name']} has no valid Indian mobile number on file."
    if not row.sms_opt_in:
        return args, (f"{args['candidate_name']} hasn't agreed to WhatsApp messages, so they can't be messaged there. "
                      "Offer email instead.")
    return {**args, "message": EVENTS[args["template"]].text}, None


@REGISTRY.tool(
    "whatsapp_candidate",
    "Send a candidate one of Hybent's approved WhatsApp messages: shortlisted, rejected, application_received, "
    "offer_sent. Finds the candidate and checks their WhatsApp consent and number itself, so call it directly. "
    "Free-text WhatsApp isn't possible; offer email for that.",
    params({"candidate_id": _S, "candidate_name": _S, "template": {"type": "string", "enum": list(_WA_TEMPLATES)},
            "job_title": _S}, required=["candidate_name", "template"]),
    kind="write",
    status="Sending WhatsApp", status_args=("candidate_name", "template"),
    validate=_validate_whatsapp, prepare=_prepare_whatsapp,
)
async def whatsapp_candidate(args: dict, ctx: ToolContext) -> ToolResult:
    from app.core.config import settings
    from app.services import sms_service
    from app.models.sms import SmsStatus

    if denied := _not_permitted(ctx):
        return denied
    c, problem = await resolve_candidate(args, ctx)
    if problem:
        return problem
    row = (await ctx.db.execute(
        text("SELECT c.phone, c.sms_opt_in, o.name AS org FROM candidates c JOIN organizations o"
             " ON o.id = c.organization_id WHERE c.id = :c"), {"c": c["id"]},
    )).fetchone()
    if not row or not row.sms_opt_in:
        return _failed(f"{c['full_name']} hasn't agreed to WhatsApp messages.")
    job = args.get("job_title") or c.get("current_title") or "the role"
    values = {"name": (c["full_name"] or "").split(" ")[0] or "there", "job": job,
              "company": row.org or "us", "link": settings.frontend_url}
    # The recruiter asked for this message explicitly, so the per-event
    # on/off switches (meant for automatic messages) don't apply.
    log = await sms_service.send(
        ctx.db, uuid.UUID(ctx.organization_id), args["template"], row.phone, values,
        recipient_name=c["full_name"], candidate_id=uuid.UUID(str(c["id"])), force=True,
    )
    if log is None or log.status != SmsStatus.SENT:
        if log is not None and log.status == SmsStatus.TEST:
            return _failed("WhatsApp is in test mode on this server; the message was logged but not delivered.")
        return _failed((log.error if log else None) or "WhatsApp message wasn't sent.")
    return ToolResult(data={"candidate": c["full_name"], "whatsapp": args["template"], "to": row.phone},
                      summary="WhatsApp sent", focus=_focus(c))
