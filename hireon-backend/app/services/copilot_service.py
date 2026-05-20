import json
import re
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Optional, Any

from groq import Groq
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks
import zoneinfo

from app.config import settings

logger = logging.getLogger(__name__)

# ── Models & Prompt ──────────────────────────────────────────────────────────

GROQ_MODEL = "llama-3.3-70b-versatile"

COPILOT_SYSTEM_PROMPT = """### 1. YOUR MISSION
You are a Recruiter Copilot. Help recruiters search for candidates, manage team members, and schedule interviews.
DO NOT write SQL. Use the tools provided.

### 2. TOOLS
- search_candidates(query, name, email, status): Find people in the DB.
- search_users(name, email): Find team members (interviewers) in your organization.
- search_jobs(title, status): Find job openings.
- schedule_meeting(candidate_name, meeting_title, scheduled_at, interviewer_names, interview_stage): Book interviews.
- get_pipeline_summary(): Retrieve counts of candidates across stages.

### 3. RULES
- **CONTEXT**: If you see a context block like `[Viewing Candidate: Name (ID)]`, use that name automatically for tools. Do not ask for the name if it's in context.
- **CLARIFY**: If multiple candidates or interviewers match a name, or if information is missing (date, stage), ALWAYS ask the user to clarify by presenting the options found.
- **FORMAT**: 👤 **[Name]** | 📧 [Email] | 📍 *[Status/Role]* (One per line).
- **TONE**: Professional, concise. Support Hinglish but keep technical instructions in English.
- **NO INTERNET**: You cannot search the web. Use only internal tools.
- **AMBIGUITY**: When the tool returns '❓ Multiple [type] found', summarize the options and ask the user to pick one using their email or full name. Do not proceed with scheduling until only 1 person is selected for each slot.
- **TOOL_CALLING**: You are an OpenAI-compatible agent. You MUST use the official tool-calling API. NEVER output text like `<function=...>` or `<tool>...</tool>`. If you need to search or schedule, just trigger the tool call directly. Any response containing `<` or `>` tags for tool calling will be rejected.

### 4. HIREON PLATFORM GUIDE & FAQ
Use this knowledge to guide users through platform features, navigation, and workflows:
- **General Navigation**:
  - Recruiter Dashboard: Overview of candidate pipeline, upcoming interviews, recent activities, and performance metrics.
  - Candidates page: List all candidates in the organization. Filter by stage, status, or search for skills.
  - Kanban Pipeline: Visual board showing candidates grouped by high-level stages. Drag-and-drop to update candidate stage.
  - Jobs page: Create and manage job openings. Active, drafted, or archived.
  - Scheduler: Book and view scheduled interviews. Integration with Google Calendar and Google Meet.
  - Team / Users page: Manage team members and assign recruiter or interviewer roles.
- **Portal Structures**:
  - Recruiter Portal: For recruiters and admins to manage jobs, candidates, schedule rounds, and view fairness/bias analytics.
  - Candidate Portal: For candidates to view their application journey, complete assignments, view interview invites, access prep hub, and review offer documents.
  - Interviewer Portal: For interviewers to view their schedule, access candidate details/resumes, and submit scorecards/feedback.
- **Workflow Instructions**:
  - *Add Candidate*: Go to Candidates page and click "Add Candidate" (manual form) or "Invite Candidate" (tokens/email).
  - *Schedule Interview*: Select a candidate, choose "Schedule Round", select interviewers, set date/time, and save. The platform automatically generates a Google Meet link and sends invitations.
  - *Evaluate Candidates*: After an interview, the interviewer submits a Scorecard. The recruiter reviews this feedback before moving the candidate to the "Offered" or "Rejected" stage.
  - *Offers*: If a candidate is moved to HR Round Selected or Interviewed, the recruiter can issue an offer. Hired candidates cannot be rejected. Enforce this business logic.
- **Intelligence Features**:
  - Candidate Prep Hub: Candidate portal feature providing AI-powered mock interviews and preparation tailored to scheduled job roles.
"""

# ── Tool Definitions for Groq SDK ───────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_candidates",
            "description": "Search for candidates by name, email, status, skill, or job title using a general query or specific fields.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "General search term for skills, titles, company, or name (e.g. 'python', 'manager')."},
                    "name": {"type": "string", "description": "Candidate's full name."},
                    "email": {"type": "string", "description": "Candidate's email address."},
                    "status": {"type": "string", "description": "Pipeline stage (e.g., applied, screening, technical_round, offered, rejected)."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pipeline_summary",
            "description": "Retrieve the current counts of candidates in each stage (applied, screening, interview, interviewed, offer, rejected).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_users",
            "description": "Search for team members (potential interviewers) by name or email.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_jobs",
            "description": "Search for job openings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "status": {"type": "string"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_meeting",
            "description": "Schedule a new interview.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {"type": "string"},
                    "meeting_title": {"type": "string"},
                    "scheduled_at": {"type": "string"},
                    "interviewer_names": {"type": "string"},
                    "interview_stage": {"type": "string"}
                },
                "required": ["candidate_name", "meeting_title", "scheduled_at"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "db_update",
            "description": "Update a record in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "table_name": {"type": "string"},
                    "record_id": {"type": "string"},
                    "update_data": {"type": "object"}
                },
                "required": ["table_name", "record_id", "update_data"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_candidate_stage",
            "description": "Update a candidate's pipeline stage (e.g., Screening Selected, Technical Round Selected, Rejected). Use this when the user wants to move a candidate to a specific stage without scheduling a meeting.",
            "parameters": {
                "type": "object",
                "properties": {
                    "candidate_name": {"type": "string", "description": "Full name of the candidate"},
                    "new_stage": {
                        "type": "string", 
                        "description": "The target stage key. Options: pre_screening_selected, pre_screening_rejected, technical_round_selected, technical_round_rejected, practical_round_selected, practical_round_rejected, techno_functional_selected, management_round_selected, hr_round_selected, offered, hired, rejected"
                    }
                },
                "required": ["candidate_name", "new_stage"]
            }
        }
    }
]

# ── Internal Tool Executors ──────────────────────────────────────────────────

async def execute_read_tool(name: str, args: dict, organization_id: str, db: AsyncSession) -> str:
    """Asynchronous tool execution for read-only actions."""
    try:
        if name == "search_candidates":
            conds, params = ["organization_id = :oid"], {"oid": organization_id}
            if args.get("name"): 
                conds.append("(full_name ILIKE :n OR current_title ILIKE :n OR CAST(skills as TEXT) ILIKE :n)")
                params["n"] = f"%{args['name']}%"
            if args.get("email"): 
                conds.append("email ILIKE :e")
                params["e"] = f"%{args['email']}%"
            if args.get("status"): 
                conds.append("pipeline_stage = :s")
                params["s"] = args["status"]
            if args.get("query"):
                conds.append("(full_name ILIKE :q OR current_title ILIKE :q OR current_company ILIKE :q OR CAST(skills as TEXT) ILIKE :q)")
                params["q"] = f"%{args['query']}%"
            
            sql = f"SELECT full_name, email, pipeline_stage as status FROM candidates WHERE {' AND '.join(conds)} LIMIT 15"
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            data = [dict(r._mapping) for r in res_all]
            return json.dumps(data) if data else "No candidates found."

        if name == "get_pipeline_summary":
            sql = """
                SELECT pipeline_stage, COUNT(*) as count 
                FROM candidates 
                WHERE organization_id = :oid 
                GROUP BY pipeline_stage
            """
            res = await db.execute(text(sql), {"oid": organization_id})
            rows = res.fetchall()
            
            from app.routers.candidates import STAGE_TO_BUCKET, REJECTION_STAGES
            
            buckets = {
                "applied": 0,
                "screening": 0,
                "interview": 0,
                "interviewed": 0,
                "offer": 0,
                "rejected": 0
            }
            
            for row in rows:
                stage = row.pipeline_stage
                count = row.count
                bucket = STAGE_TO_BUCKET.get(stage)
                if not bucket and stage in REJECTION_STAGES:
                    bucket = "rejected"
                if not bucket:
                    if stage is None or stage == "needs_review":
                        bucket = "applied"
                    else:
                        continue
                if bucket in buckets:
                    buckets[bucket] += count
                    
            return json.dumps(buckets)

        if name == "search_users":
            conds, params = ["organization_id = :oid"], {"oid": organization_id}
            if args.get("name"): conds.append("full_name ILIKE :n"); params["n"] = f"%{args['name']}%"
            if args.get("email"): conds.append("email ILIKE :e"); params["e"] = f"%{args['email']}%"
            
            sql = f"SELECT full_name, email, role FROM users WHERE {' AND '.join(conds)} LIMIT 15"
            res = await db.execute(text(sql), params)
            res_all = res.fetchall()
            data = [dict(r._mapping) for r in res_all]
            return json.dumps(data) if data else "No team members found."

        if name == "search_jobs":
            sql = "SELECT title, status, location FROM jobs WHERE organization_id = :oid LIMIT 10"
            res = await db.execute(text(sql), {"oid": organization_id})
            res_all = res.fetchall()
            data = [dict(r._mapping) for r in res_all]
            return json.dumps(data) if data else "No jobs found."
            
        return "Unknown read tool."
    except Exception as e:
        return f"Error: {str(e)}"

async def execute_write_tool(name: str, args: dict, organization_id: str, user_id: str, db: AsyncSession) -> str:
    """Asynchronous tool execution for write/mutation actions."""
    try:
        if name == "schedule_meeting":
            c_name, title, at = args.get("candidate_name"), args.get("meeting_title"), args.get("scheduled_at")
            ivs, stage = args.get("interviewer_names"), args.get("interview_stage")
            
            # 1. Fetch Org & User Details (Timezone & Refresh Token)
            from app.models.organization import Organization
            from app.models.user import User
            
            # Ensure organization_id is UUID
            oid = uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

            org_res = await db.execute(text("SELECT id, name, timezone, logo_url FROM organizations WHERE id = :oid"), {"oid": oid})
            org = org_res.fetchone()
            if not org: return "❌ Organization not found."
            
            user_res = await db.execute(text("SELECT google_refresh_token FROM users WHERE id = :uid"), {"uid": uid})
            recruiter = user_res.fetchone()
            
            # 2. Robust Date Parsing with Timezone
            from dateutil.parser import parse as parse_date
            try:
                dt = parse_date(at)
                # Localize if naive
                if dt.tzinfo is None:
                    tz = zoneinfo.ZoneInfo(org.timezone or "Asia/Kolkata")
                    dt = dt.replace(tzinfo=tz)
                # Convert to UTC for DB storage
                dt_utc = dt.astimezone(timezone.utc).replace(tzinfo=None)
            except Exception as e:
                return f"❌ Could not understand the date '{at}'. Please provide a clearer date and time (Error: {e})."

            # 3. Find Candidate
            c_res = await db.execute(text("SELECT id, full_name, email FROM candidates WHERE full_name ILIKE :n AND organization_id = :o"), 
                                     {"n":f"%{c_name}%","o":oid})
            candidates = c_res.fetchall()
            if not candidates: return f"❌ Candidate '{c_name}' not found."
            if len(candidates) > 1:
                matches = "\n".join([f"- {r.full_name} ({r.email})" for r in candidates])
                return f"❓ Multiple candidates found for '{c_name}':\n{matches}\n\nPlease specify which one you mean (using their email)."
            
            c = candidates[0]
            
            # 4. Find Application
            app_res = await db.execute(text("SELECT id FROM applications WHERE candidate_id = :cid ORDER BY applied_at DESC LIMIT 1"), {"cid":c.id})
            app = app_res.fetchone()
            aid = app[0] if app else None
            
            # 5. Look up Interviewers
            interviewer_ids, attendee_emails = [], [c.email]
            not_found_ivs = []
            ambiguous_ivs = {}
            
            if ivs:
                iv_names = [n.strip() for n in ivs.split(",")]
                for ivn in iv_names:
                    # Fetch all possible matches to detect ambiguity
                    u_res = await db.execute(text("SELECT id, email, full_name FROM users WHERE (full_name ILIKE :n OR email ILIKE :n) AND organization_id = :o"), 
                                            {"n":f"%{ivn}%","o":oid})
                    matches = u_res.fetchall()
                    
                    if not matches:
                        not_found_ivs.append(ivn)
                    elif len(matches) > 1:
                        ambiguous_ivs[ivn] = [f"{r.full_name} ({r.email})" for r in matches]
                    else:
                        u = matches[0]
                        interviewer_ids.append(u)
                        attendee_emails.append(u.email)

            if ambiguous_ivs:
                msg = "❓ Multiple interviewers found. Please clarify which one you mean:\n"
                for name, options in ambiguous_ivs.items():
                    msg += f"\nFor '{name}':\n" + "\n".join([f"- {opt}" for opt in options])
                return msg

            if not_found_ivs:
                return f"❌ Could not find interviewer(s): {', '.join(not_found_ivs)}. Please make sure they are added to your team."

            # 6. Create Calendar Event (Google Meet)
            from app.services.calendar_service import create_calendar_event
            cal = await create_calendar_event(
                title=title,
                description=f"Interview with {c.full_name}",
                start_time=dt,
                duration_minutes=60,
                attendee_emails=attendee_emails,
                organizer_refresh_token=recruiter.google_refresh_token if recruiter else None
            )

            # 7. Database Inserts
            iid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            await db.execute(text("INSERT INTO interviews (id, candidate_id, application_id, title, scheduled_at, organization_id, status, scheduled_by_id, created_at, updated_at, meeting_link, calendar_event_id, interview_type) VALUES (:id, :cid, :aid, :t, :at, :oid, 'scheduled', :sid, :now, :now, :ml, :ce, 'video')"),
                         {"id":iid, "cid":c.id, "aid":aid, "t":title, "at":dt_utc, "oid":oid, "sid": uid, "now": now, "ml": cal["meeting_link"], "ce": cal.get("event_id")})
            
            for u in interviewer_ids:
                await db.execute(text("INSERT INTO interview_panelists (id, interview_id, user_id, role) VALUES (:id, :iid, :uid, 'panelist')"),
                             {"id":str(uuid.uuid4()), "iid":iid, "uid":u.id})
            
            # Update candidate status
            new_stage = stage if stage else 'screening'
            await db.execute(text("UPDATE candidates SET pipeline_stage = :s WHERE id = :cid"), {"s":new_stage, "cid":c.id})
            
            # 8. Send Emails & Notifications
            from app.services.email_service import send_interview_invite, send_interviewer_invite
            from app.tasks.notifications import notify_interview_team
            from app.utils.permissions import NotificationType

            tz_str = org.timezone or "Asia/Kolkata"
            local_tz = zoneinfo.ZoneInfo(tz_str)
            time_str = dt.astimezone(local_tz).strftime("%B %d, %Y at %I:%M %p")

            # Fetch job title fallback
            job_title = "Position"
            if aid:
                j_res = await db.execute(text("SELECT j.title FROM jobs j JOIN applications a ON a.job_id = j.id WHERE a.id = :aid"), {"aid": aid})
                jr = j_res.fetchone()
                if jr: job_title = jr[0]

            # Email Candidate
            send_interview_invite(
                candidate_email=c.email, candidate_name=c.full_name,
                round_name=title, job_role=job_title, company_name=org.name,
                scheduled_at=time_str, meeting_link=cal["meeting_link"],
                duration_minutes=60, interview_type="video", org_logo_url=org.logo_url
            )
            
            # Email Interviewers
            for u in interviewer_ids:
                send_interviewer_invite(
                    interviewer_email=u.email, interviewer_name=u.full_name,
                    candidate_name=c.full_name, round_name=title, job_role=job_title,
                    company_name=org.name, scheduled_at=time_str, meeting_link=cal["meeting_link"],
                    duration_minutes=60, interview_type="video", org_logo_url=org.logo_url
                )

            # Team Notification
            notify_interview_team.delay(
                iid, NotificationType.INTERVIEW_SCHEDULED, "Interview Scheduled",
                f"A new interview '{title}' has been scheduled for {c.full_name} on {time_str}.",
                {"interview_id": iid, "candidate": c.full_name, "scheduled_at": time_str}
            )

            await db.commit()
            iv_str = f" with {ivs}" if ivs else ""
            return f"✅ Successfully scheduled '{title}'{iv_str} for {c.full_name} at {time_str}. Emails sent and Meet link generated."

            return f"✅ Updated {table} record."

        if name == "update_candidate_stage":
            c_name, new_stage = args.get("candidate_name"), args.get("new_stage")
            oid = uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            uid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id

            # 1. Find Candidate (Using existing robust logic)
            c_res = await db.execute(text("SELECT id, full_name, email, pipeline_stage FROM candidates WHERE full_name ILIKE :n AND organization_id = :o"), 
                                     {"n":f"%{c_name}%","o":oid})
            candidates = c_res.fetchall()
            if not candidates: return f"❌ Candidate '{c_name}' not found."
            if len(candidates) > 1:
                matches = "\n".join([f"- {r.full_name} ({r.email})" for r in candidates])
                return f"❓ Multiple candidates found for '{c_name}':\n{matches}\n\nPlease specify which one you mean (using their email)."
            
            c = candidates[0]
            old_stage = c.pipeline_stage

            # 2. Update Candidate
            await db.execute(text("UPDATE candidates SET pipeline_stage = :s, updated_at = :now WHERE id = :cid AND organization_id = :oid"), 
                             {"s": new_stage, "cid": c.id, "now": datetime.now(timezone.utc), "oid": oid})
            
            # 3. Update Applications (Sync)
            await db.execute(text("UPDATE applications SET stage = :s, updated_at = :now WHERE candidate_id = :cid AND organization_id = :oid"), 
                             {"s": new_stage, "cid": c.id, "now": datetime.now(timezone.utc), "oid": oid})

            # 4. Activity Log & Notifications
            from app.services.activity_service import log_activity
            await log_activity(db, oid, uid, "UPDATE_STAGE", "candidate", str(c.id), {"name": c.full_name, "from": old_stage, "to": new_stage})
            
            from app.tasks.notifications import notify_organization_roles
            from app.utils.permissions import UserRole, NotificationType, REJECTION_STAGES
            notify_organization_roles.delay(
                str(oid), [UserRole.ADMIN, UserRole.RECRUITER], NotificationType.CANDIDATE_UPDATED,
                "Stage Updated", f"Candidate '{c.full_name}' was moved from {old_stage or 'Applied'} to {new_stage}.",
                {"candidate_id": str(c.id)}
            )

            # 5. Automated Rejection Email
            if new_stage in REJECTION_STAGES and old_stage not in REJECTION_STAGES:
                from app.services.email_service import send_rejection_email
                from app.models.organization import Organization
                
                org_res = await db.execute(text("SELECT name, logo_url FROM organizations WHERE id = :oid"), {"oid": oid})
                org = org_res.fetchone()
                company_name = org.name if org else "the team"
                
                send_rejection_email(
                    candidate_email=c.email,
                    candidate_name=c.full_name,
                    job_title="the applied position", # We can refine this if we fetch job title
                    company_name=company_name,
                    org_logo_url=org.logo_url if org else None
                )

            await db.commit()
            return f"✅ Successfully moved {c.full_name} to stage: {new_stage}."

        if name == "db_update":
            table_name = args.get("table_name")
            record_id = args.get("record_id")
            update_data = args.get("update_data")
            
            if not table_name or not record_id or not update_data:
                return "❌ Missing table_name, record_id, or update_data for update."
            
            # Simple whitelist of allowed tables for security/integrity
            allowed_tables = ["candidates", "users", "jobs", "interviews", "applications"]
            if table_name not in allowed_tables:
                return f"❌ Updates to table '{table_name}' are not allowed."
            
            # Build safe update query
            set_clauses = []
            params = {
                "rid": uuid.UUID(record_id) if isinstance(record_id, str) else record_id, 
                "oid": uuid.UUID(organization_id) if isinstance(organization_id, str) else organization_id
            }
            
            for k, v in update_data.items():
                if not re.match(r"^[a-zA-Z0-9_]+$", k):
                    return f"❌ Invalid column name: {k}"
                
                if isinstance(v, str):
                    try:
                        v = uuid.UUID(v)
                    except ValueError:
                        pass
                
                set_clauses.append(f"{k} = :{k}")
                params[k] = v
            
            sql = f"UPDATE {table_name} SET {', '.join(set_clauses)}, updated_at = NOW() WHERE id = :rid AND organization_id = :oid"
            await db.execute(text(sql), params)
            await db.commit()
            return f"✅ Successfully updated {table_name} record (ID: {record_id})."

        return "Write tool executed."
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in execute_write_tool: {e}")
        return f"Error during execution: {str(e)}"

def extract_hallucinated_tool_call(text: str) -> Optional[tuple[str, dict]]:
    known_tools = [
        "search_candidates",
        "search_users",
        "search_jobs",
        "schedule_meeting",
        "db_update",
        "update_candidate_stage",
        "get_pipeline_summary"
    ]
    # Clean up escaped characters
    text_clean = text.replace('\\"', '"').replace("\\'", "'").replace('\\n', '\n')
    
    for tool_name in known_tools:
        idx = text_clean.find(tool_name)
        if idx != -1:
            start_json = text_clean.find("{", idx)
            if start_json != -1:
                # Find matching closing brace to extract exactly the JSON string
                braces = 0
                for i in range(start_json, len(text_clean)):
                    char = text_clean[i]
                    if char == '{':
                        braces += 1
                    elif char == '}':
                        braces -= 1
                        if braces == 0:
                            json_str = text_clean[start_json:i+1]
                            try:
                                args = json.loads(json_str)
                                return tool_name, args
                            except json.JSONDecodeError:
                                try:
                                    import ast
                                    args = ast.literal_eval(json_str)
                                    if isinstance(args, dict):
                                        return tool_name, args
                                except:
                                    pass
                                break
            else:
                return tool_name, {}
    return None

def resolve_tool_args_context(name: str, args: dict, page_context: Optional[dict]) -> dict:
    if not isinstance(args, dict):
        args = {}
    # 1. Resolve candidate name placeholder from page context
    c_name = args.get("candidate_name")
    if c_name and name in ["schedule_meeting", "update_candidate_stage"]:
        c_name_lower = c_name.lower().strip("[]() ")
        placeholders = [
            "currently viewed candidate's name",
            "currently viewed candidate",
            "candidate name",
            "candidate's name",
            "candidate_email",
            "candidate",
            "a candidate",
            "the candidate",
            "name",
            "[candidate name]",
            "placeholder",
            "unknown"
        ]
        if c_name_lower in placeholders or any(p in c_name_lower for p in ["currently viewed", "placeholder", "candidate_name"]):
            if page_context:
                ctx_name = page_context.get("candidate_name")
                if ctx_name:
                    args["candidate_name"] = ctx_name
                    logger.info(f"Resolved placeholder candidate_name '{c_name}' to '{ctx_name}' from page_context")
    
    # 2. Clean up placeholder interviewer names
    ivs = args.get("interviewer_names")
    if ivs:
        ivs_lower = ivs.lower().strip("[]() ")
        if ivs_lower in ["interviewer_names", "interviewer name", "interviewer", "interviewers", "placeholder"]:
            args.pop("interviewer_names", None)
            logger.info("Removed placeholder interviewer_names")
            
    return args


# ── Chat Service ─────────────────────────────────────────────────────────────

async def run_copilot_chat(
    user_message: str,
    history: list[dict],
    organization_id: uuid.UUID,
    db: AsyncSession,
    page_context: Optional[dict] = None,
    background_tasks: Optional[BackgroundTasks] = None,
    user_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[str] = None,
    approved_tool_call: Optional[dict] = None,
) -> dict:
    
    client = Groq(api_key=settings.groq_api_key)
    oid_str = str(organization_id)
    uid_str = str(user_id)

    # 1. Handle Approval Execution
    if approved_tool_call:
        name = approved_tool_call.get("name")
        args = approved_tool_call.get("args", {})
        result_text = await execute_write_tool(name, args, oid_str, uid_str, db)
        # Add success to history and save
        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, result_text)
        return {"reply": result_text, "error": False, "conversation_id": conversation_id}

    # 2. Build Messages
    curr_time = datetime.now().strftime("%A, %b %d, %Y %I:%M %p")
    sys_prompt = f"{COPILOT_SYSTEM_PROMPT}\n\nCURRENT_TIME: {curr_time}\n(Note: Always convert relative dates like 'tomorrow' or 'next week' into YYYY-MM-DD format based on CURRENT_TIME when calling tools.)"
    
    messages = [{"role": "system", "content": sys_prompt}]
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    
    # Inject context
    prompt = user_message
    if page_context and page_context.get("candidate_id"):
        c_name = page_context.get("candidate_name", "Unknown")
        c_id = page_context.get("candidate_id")
        prompt = f"[Viewing Candidate: {c_name} ({c_id})]\n\n{user_message}"
    messages.append({"role": "user", "content": prompt})

    # 3. Call AI
    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )
        
        resp_msg = response.choices[0].message
        
        # 4. Handle Tool Calls
        if resp_msg.tool_calls:
            tool_call = resp_msg.tool_calls[0]
            name = tool_call.function.name
            # Safely parse tool arguments
            if tool_call.function.arguments:
                try:
                    args = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse tool arguments for {name}, defaulting to empty dict.")
                    args = {}
            else:
                args = {}
                args = {}
            
            # Resolve placeholders
            args = resolve_tool_args_context(name, args, page_context)
            
            # Read Tools -> Immediate
            if name in ["search_candidates", "search_jobs", "search_users", "get_pipeline_summary"]:
                result = await execute_read_tool(name, args, oid_str, db)
                # Second call for summary
                messages.append(resp_msg)
                messages.append({"role": "tool", "tool_call_id": tool_call.id, "name": name, "content": result})
                final_resp = client.chat.completions.create(model=GROQ_MODEL, messages=messages)
                final_text = final_resp.choices[0].message.content
                conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, final_text)
                return {"reply": final_text, "error": False, "conversation_id": conversation_id}
            
            # Write Tools -> Approval Required
            else:
                reply = "I've prepared an update. Please approve it to proceed."
                new_conv_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
                return {
                    "reply": reply,
                    "requires_approval": True,
                    "pending_tool_call": {"name": name, "args": args, "id": tool_call.id},
                    "conversation_id": new_conv_id
                }

        # 5. Normal Reply (with Fallback for manual function tags/hallucinations)
        reply = resp_msg.content or ""
        
        # Robust regex to catch "update_candidate_stage" even inside Chinese text or weird tags
        # It looks for the tool name and then a JSON-like block
        for tool_name in ["update_candidate_stage", "schedule_meeting"]:
            if tool_name in reply:
                json_match = re.search(r"\{.*?\}", reply, re.DOTALL)
                if json_match:
                    try:
                        args = json.loads(json_match.group(0))
                        reply_text = "I've prepared an update. Please approve it to proceed."
                        new_conv_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply_text)
                        return {
                            "reply": reply_text,
                            "requires_approval": True,
                            "pending_tool_call": {"name": tool_name, "args": args},
                            "conversation_id": new_conv_id
                        }
                    except: continue

        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
        return {"reply": reply, "error": False, "conversation_id": conversation_id}

    except Exception as e:
        # Rollback the session first to reset transaction state
        try:
            await db.rollback()
        except Exception as rollback_err:
            logger.error(f"Failed to rollback DB session: {rollback_err}")

        # ── Hallucination Recovery Logic ──────────────────────────────────────
        # If Groq returns a 400 because of bad tool-call formatting, 
        # we can still try to parse the "failed_generation" manually.
        failed_gen = None
        if hasattr(e, 'body') and isinstance(e.body, dict):
            failed_gen = e.body.get("error", {}).get("failed_generation")
        
        if not failed_gen:
            error_str = str(e)
            if "failed_generation" in error_str:
                failed_gen = error_str
                
        if failed_gen:
            try:
                recovered = extract_hallucinated_tool_call(failed_gen)
                if recovered:
                    tool_name, args = recovered
                    # Resolve placeholders
                    args = resolve_tool_args_context(tool_name, args, page_context)
                    logger.info(f"Recovered hallucinated tool call: {tool_name} with args {args}")
                    
                    # Handle Read vs Write tools like the main loop
                    if tool_name in ["search_candidates", "search_jobs", "search_users", "get_pipeline_summary"]:
                        result = await execute_read_tool(tool_name, args, oid_str, db)
                        # Add a manual reply based on the tool result
                        reply = f"I found some information for you:\n\n{result}" if "No" not in result else result
                        conversation_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
                        return {"reply": reply, "error": False, "conversation_id": conversation_id}
                    else:
                        # Requires approval
                        reply = "I've prepared an update. Please approve it to proceed."
                        new_conv_id = await _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, reply)
                        return {
                            "reply": reply,
                            "requires_approval": True,
                            "pending_tool_call": {"name": tool_name, "args": args},
                            "conversation_id": new_conv_id
                        }
                else:
                    logger.warning("Could not recover hallucinated tool call from failed generation.")
            except Exception as recovery_err:
                logger.error(f"Recovery logic failed: {recovery_err}")

        logger.error(f"Copilot Error: {e}")
        return {"reply": "Sorry, I'm having trouble. Try again later.", "error": True}

# ── Helper ──────────────────────────────────────────────────────────────────

async def _save_conversation_to_db(db, organization_id, user_id, conversation_id, user_message, assistant_reply) -> str:
    from app.models.copilot_conversation import CopilotConversation, CopilotMessage
    conversation = None
    if conversation_id:
        try:
            res = await db.execute(select(CopilotConversation).where(CopilotConversation.id == uuid.UUID(conversation_id)))
            conversation = res.scalar_one_or_none()
        except: pass
    
    if not conversation:
        conversation = CopilotConversation(organization_id=organization_id, user_id=user_id, title=user_message[:50])
        db.add(conversation)
        await db.flush()

    db.add(CopilotMessage(conversation_id=conversation.id, role="user", content=user_message))
    db.add(CopilotMessage(conversation_id=conversation.id, role="assistant", content=assistant_reply))
    return str(conversation.id)
