from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from app.models.application import Application
from app.models.job import Job
from app.models.candidate import Candidate
from app.utils.permissions import ApplicationStage, REJECTION_STAGES
import csv
import io

BACKOUT_STAGES = [
    "technical_round_back_out",
    "practical_round_back_out",
    "offered_back_out",
]

async def get_report_summary(organization_id: UUID, user_id: UUID, is_admin: bool, db: Session, recruiter_id: str | None = None):
    print(f"DEBUG: get_report_summary called for org={organization_id}, admin={is_admin}, recruiter={recruiter_id}")
    
    # We want a comprehensive view of all candidates/applications in the org
    # For Applied, we count all distinct candidates in the org
    # For others, we look at the 'best' progress or recent status
    
    # 1. Total Candidates (Applied)
    from app.models.candidate import Candidate
    cand_query = select(Candidate).where(Candidate.organization_id == organization_id)
    if not is_admin:
        cand_query = cand_query.where(Candidate.created_by_id == user_id)
    elif recruiter_id:
        cand_query = cand_query.where(Candidate.created_by_id == UUID(recruiter_id))
    
    res_cands = await db.execute(cand_query)
    all_candidates = res_cands.scalars().all()
    
    # 2. Get all Applications to find further progress
    app_query = select(Application).where(Application.organization_id == organization_id)
    if not is_admin:
        app_query = app_query.join(Candidate, Application.candidate_id == Candidate.id).where(Candidate.created_by_id == user_id)
    elif recruiter_id:
        app_query = app_query.join(Candidate, Application.candidate_id == Candidate.id).where(Candidate.created_by_id == UUID(recruiter_id))
        
    res_apps = await db.execute(app_query)
    all_apps = res_apps.scalars().all()
    
    # 3. Join logic to find the 'primary' stage for each candidate
    candidate_stages = {}
    candidates_by_role = {}
    
    # Track roles from applications
    for a in all_apps:
        # Get role title (either from job or candidate's meta)
        # We'll use a's job relation if loaded, but here we might need to join/select
        # For now, let's assume we want to count apps per job
        # Since 'job' is lazy=noload, we should have probably joined it.
        pass

    # Re-fetch with Job join to get titles
    app_with_jobs_query = select(Application, Job.title).join(Job, Application.job_id == Job.id).where(Application.organization_id == organization_id)
    if not is_admin:
        app_with_jobs_query = app_with_jobs_query.join(Candidate, Application.candidate_id == Candidate.id).where(Candidate.created_by_id == user_id)
    elif recruiter_id:
        app_with_jobs_query = app_with_jobs_query.join(Candidate, Application.candidate_id == Candidate.id).where(Candidate.created_by_id == UUID(recruiter_id))
    
    res_apps_jobs = await db.execute(app_with_jobs_query)
    for app_obj, job_title in res_apps_jobs.all():
        candidates_by_role[job_title] = candidates_by_role.get(job_title, 0) + 1
        candidate_stages[app_obj.candidate_id] = app_obj.stage

    # Fill in candidates without apps
    for c in all_candidates:
        if c.id not in candidate_stages and c.pipeline_stage:
            candidate_stages[c.id] = c.pipeline_stage

    final_stages = list(candidate_stages.values())
    
    # 4. Distribution of all stages
    stages_distribution = {}
    for s in final_stages:
        stages_distribution[s] = stages_distribution.get(s, 0) + 1

    hired_count = sum(1 for s in final_stages if s in ["hired", "hired_joined"])
    backout_count = sum(1 for s in final_stages if s in BACKOUT_STAGES)
    rejected_count = sum(1 for s in final_stages if s in REJECTION_STAGES and s not in BACKOUT_STAGES)
    
    summary = {
        "applied": len(all_candidates),
        "hired": hired_count,
        "backout": backout_count,
        "rejected": rejected_count,
        "stages_distribution": stages_distribution,
        "candidates_by_role": candidates_by_role
    }
    
    print(f"DEBUG: Final report summary with extra charts data: {summary}")
    return summary

async def export_report_excel(
    organization_id: UUID, 
    user_id: UUID, 
    is_admin: bool, 
    db: Session,
    days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    recruiter_id: str | None = None
):
    import pandas as pd
    from datetime import timedelta
    from app.models.user import User

    query = (
        select(Application, Job, Candidate, User.full_name.label("added_by"))
        .join(Job, Application.job_id == Job.id)
        .join(Candidate, Application.candidate_id == Candidate.id)
        .outerjoin(User, Candidate.created_by_id == User.id)
        .where(Application.organization_id == organization_id)
    )

    # Role Isolation
    if not is_admin:
        query = query.where(Candidate.created_by_id == user_id)
    elif recruiter_id:
        # Admin filtering by specific recruiter
        query = query.where(Candidate.created_by_id == UUID(recruiter_id))

    # Date Filters
    if days:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(Application.applied_at >= cutoff)
    elif start_date:
        start = datetime.fromisoformat(start_date)
        query = query.where(Application.applied_at >= start)
        if end_date:
            end = datetime.fromisoformat(end_date)
            query = query.where(Application.applied_at <= end)

    # Sorting (Oldest first as requested)
    query = query.order_by(Application.applied_at.asc())
        
    result = await db.execute(query)
    rows = result.all()
    
    data = []
    for idx, (app, job, cand, added_by) in enumerate(rows, 1):
        data.append({
            "Sr No": idx,
            "Date": app.applied_at.strftime("%Y-%m-%d"),
            "Candidate Name": cand.full_name,
            "Candidate Email": cand.email,
            "Job Title": job.title,
            "Current Stage": app.stage.replace("_", " ").title(),
            "Match Score": f"{app.match_score:.1f}%" if app.match_score else "N/A",
            "Source": app.source or "Direct",
            "Added By": added_by or "System"
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Recruitment Report')
        
    return output.getvalue()
