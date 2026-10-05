"""
Analytics aggregation service.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.models.candidate import Candidate
from app.models.interview import Interview
from app.models.job import Job
from app.models.offer import Offer
from app.models.scorecard import Scorecard
from app.schemas.analytics import (
    AnalyticsOverview, FunnelStage, FunnelData,
    ScoreDistributionBucket, InterviewerPerformance, FairnessMetrics,
    StagePassRate, SourcePassRate, InterviewerCalibration
)
from app.utils.permissions import ApplicationStage, OfferStatus


async def get_overview(org_id: uuid.UUID, db: AsyncSession, user_id: uuid.UUID | None = None) -> AnalyticsOverview:
    """High-level KPI overview for the org, optionally filtered by user."""

    # Period boundaries for delta calculation (last 30 days vs the 30 days before that)
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=30)   # current window start
    prev_start   = now - timedelta(days=60)   # previous window start

    # Base conditions for subqueries
    job_cond = [Job.organization_id == org_id]
    app_cond = [Application.organization_id == org_id]
    cand_cond = [Candidate.organization_id == org_id]
    int_cond = [Interview.organization_id == org_id]
    off_cond = [Offer.organization_id == org_id]

    if user_id:
        job_cond.append(Job.created_by_id == user_id)
        # For applications, we filter by the owner of the job it belongs to
        app_cond.append(Application.job_id.in_(select(Job.id).where(Job.created_by_id == user_id)))
        # Interviews scheduled by the user
        int_cond.append(Interview.scheduled_by_id == user_id)
        # Offers created by the user (assuming we track this, or skip if not in model yet)
        # Note: Offer model doesn't have created_by_id currently, but let's assume we might need it.
        # For now, we'll filter by jobs owned by the user
        off_cond.append(Offer.application_id.in_(
            select(Application.id).join(Job, Application.job_id == Job.id).where(Job.created_by_id == user_id)
        ))
        
        # Candidates is tricky as it has no owner, but we can filter by those who have apps in user's jobs
        cand_cond.append(Candidate.id.in_(
            select(Application.candidate_id).join(Job, Application.job_id == Job.id).where(Job.created_by_id == user_id)
        ))

    resumes_processed_cond = [
        *cand_cond,
        or_(
            Candidate.resume_url.isnot(None),
            Candidate.parsed_data.isnot(None),
            Candidate.match_score.isnot(None),
        ),
    ]
    auto_shortlisted_cond = [
        *cand_cond,
        Candidate.pipeline_stage == ApplicationStage.PRE_SCREENING_SELECTED.value,
    ]

    stmt = select(
        # ── All-time KPIs ──────────────────────────────────────────────────────
        select(func.count(Job.id)).where(*job_cond).scalar_subquery().label("total_jobs"),
        select(func.count(Job.id)).where(*job_cond, Job.status == "active").scalar_subquery().label("active_jobs"),
        select(func.count(Application.id)).where(*app_cond).scalar_subquery().label("total_apps"),
        select(func.count(Candidate.id)).where(*cand_cond).scalar_subquery().label("total_candidates"),
        select(func.count(Candidate.id)).where(*resumes_processed_cond).scalar_subquery().label("resumes_processed"),
        select(func.count(Candidate.id)).where(*auto_shortlisted_cond).scalar_subquery().label("auto_shortlisted"),
        select(func.count(Interview.id)).where(*int_cond).scalar_subquery().label("interviews_scheduled"),
        select(func.count(Offer.id)).where(
            *off_cond, Offer.status.in_(["sent", "accepted", "declined"])
        ).scalar_subquery().label("offers_sent"),
        select(func.count(Offer.id)).where(
            *off_cond, Offer.status == OfferStatus.ACCEPTED
        ).scalar_subquery().label("offers_accepted"),
        select(func.avg(Application.match_score)).where(
            *app_cond, Application.match_score.isnot(None)
        ).scalar_subquery().label("avg_score"),
        # ── Current period: last 30 days ───────────────────────────────────────
        select(func.count(Application.id)).where(
            *app_cond, Application.applied_at >= period_start
        ).scalar_subquery().label("curr_apps"),
        select(func.count(Candidate.id)).where(
            *cand_cond, Candidate.created_at >= period_start
        ).scalar_subquery().label("curr_cands"),
        select(func.count(Candidate.id)).where(
            *resumes_processed_cond, Candidate.created_at >= period_start
        ).scalar_subquery().label("curr_resumes_processed"),
        select(func.count(Candidate.id)).where(
            *auto_shortlisted_cond, Candidate.created_at >= period_start
        ).scalar_subquery().label("curr_auto_shortlisted"),
        select(func.count(Interview.id)).where(
            *int_cond, Interview.scheduled_at >= period_start
        ).scalar_subquery().label("curr_interviews"),
        select(func.count(Offer.id)).where(
            *off_cond, Offer.status == OfferStatus.ACCEPTED, Offer.responded_at >= period_start
        ).scalar_subquery().label("curr_offers"),
        # ── Previous period: 30–60 days ago ────────────────────────────────────
        select(func.count(Application.id)).where(
            *app_cond, Application.applied_at >= prev_start, Application.applied_at < period_start
        ).scalar_subquery().label("prev_apps"),
        select(func.count(Candidate.id)).where(
            *cand_cond, Candidate.created_at >= prev_start, Candidate.created_at < period_start
        ).scalar_subquery().label("prev_cands"),
        select(func.count(Candidate.id)).where(
            *resumes_processed_cond, Candidate.created_at >= prev_start, Candidate.created_at < period_start
        ).scalar_subquery().label("prev_resumes_processed"),
        select(func.count(Candidate.id)).where(
            *auto_shortlisted_cond, Candidate.created_at >= prev_start, Candidate.created_at < period_start
        ).scalar_subquery().label("prev_auto_shortlisted"),
        select(func.count(Interview.id)).where(
            *int_cond, Interview.scheduled_at >= prev_start, Interview.scheduled_at < period_start
        ).scalar_subquery().label("prev_interviews"),
        select(func.count(Offer.id)).where(
            *off_cond, Offer.status == OfferStatus.ACCEPTED,
            Offer.responded_at >= prev_start, Offer.responded_at < period_start
        ).scalar_subquery().label("prev_offers"),
    )

    row = (await db.execute(stmt)).first()

    def calc_delta(curr: int, prev: int) -> float | None:
        """Returns real % change only when both periods have data.
        Returns None (badge hidden) when there is no previous period to compare against.
        This ensures only genuine trend data is shown — never fake values.
        """
        if not prev:
            return None
        return round(((curr - prev) / prev) * 100, 1)

    return AnalyticsOverview(
        total_jobs=row.total_jobs or 0,
        active_jobs=row.active_jobs or 0,
        total_applications=row.total_apps or 0,
        total_candidates=row.total_candidates or 0,
        resumes_processed=row.resumes_processed or 0,
        auto_shortlisted=row.auto_shortlisted or 0,
        interviews_scheduled=row.interviews_scheduled or 0,
        offers_sent=row.offers_sent or 0,
        offers_accepted=row.offers_accepted or 0,
        avg_match_score=round(float(row.avg_score), 1) if row.avg_score else None,
        time_to_hire_days=None,
        total_applications_delta=calc_delta(row.curr_apps or 0, row.prev_apps or 0),
        total_candidates_delta=calc_delta(row.curr_cands or 0, row.prev_cands or 0),
        resumes_processed_delta=calc_delta(row.curr_resumes_processed or 0, row.prev_resumes_processed or 0),
        auto_shortlisted_delta=calc_delta(row.curr_auto_shortlisted or 0, row.prev_auto_shortlisted or 0),
        interviews_scheduled_delta=calc_delta(row.curr_interviews or 0, row.prev_interviews or 0),
        offers_accepted_delta=calc_delta(row.curr_offers or 0, row.prev_offers or 0),
    )


async def get_funnel(org_id: uuid.UUID, job_id: uuid.UUID | None, db: AsyncSession, user_id: uuid.UUID | None = None) -> FunnelData:
    """Application funnel by stage, optionally filtered by user."""
    stages = [s.value for s in ApplicationStage]
    
    conditions = [Application.organization_id == org_id]
    if job_id:
        conditions.append(Application.job_id == job_id)
    elif user_id:
        # If no specific job, but user_id provided, filter by user's jobs
        conditions.append(Application.job_id.in_(select(Job.id).where(Job.created_by_id == user_id)))

    # Use GROUP BY to get all stage counts in one query
    stmt = (
        select(Application.stage, func.count(Application.id))
        .where(*conditions)
        .group_by(Application.stage)
    )
    
    result_rows = (await db.execute(stmt)).all()
    counts = {row[0]: row[1] for row in result_rows}
    total = sum(counts.values())

    result = []
    for stage in stages:
        count = counts.get(stage, 0)
        result.append(FunnelStage(
            stage=stage,
            count=count,
            percentage=round(count / total * 100, 1) if total > 0 else 0.0,
        ))

    return FunnelData(job_id=str(job_id) if job_id else None, stages=result)


async def get_score_distribution(org_id: uuid.UUID, db: AsyncSession) -> list[ScoreDistributionBucket]:
    """Distribute application match scores into buckets."""
    # Use CASE to bucket scores in a single query
    stmt = select(
        func.count(Application.id).filter(and_(Application.match_score >= 0, Application.match_score <= 20)).label("bucket1"),
        func.count(Application.id).filter(and_(Application.match_score >= 21, Application.match_score <= 40)).label("bucket2"),
        func.count(Application.id).filter(and_(Application.match_score >= 41, Application.match_score <= 60)).label("bucket3"),
        func.count(Application.id).filter(and_(Application.match_score >= 61, Application.match_score <= 80)).label("bucket4"),
        func.count(Application.id).filter(and_(Application.match_score >= 81, Application.match_score <= 100)).label("bucket5"),
    ).where(Application.organization_id == org_id)

    row = (await db.execute(stmt)).first()
    
    return [
        ScoreDistributionBucket(range="0-20", count=row.bucket1 or 0),
        ScoreDistributionBucket(range="21-40", count=row.bucket2 or 0),
        ScoreDistributionBucket(range="41-60", count=row.bucket3 or 0),
        ScoreDistributionBucket(range="61-80", count=row.bucket4 or 0),
        ScoreDistributionBucket(range="81-100", count=row.bucket5 or 0),
    ]


async def get_interviewer_performance(org_id: uuid.UUID, db: AsyncSession) -> list[InterviewerPerformance]:
    """Per-interviewer scorecard stats."""
    from app.models.user import User
    from app.models.interview import InterviewPanelist

    result = await db.execute(
        select(
            User.id, User.full_name,
            func.count(InterviewPanelist.id).label("interviews"),
            func.avg(Scorecard.overall_rating).label("avg_rating"),
            func.count(Scorecard.id).label("scorecards"),
        )
        .join(InterviewPanelist, InterviewPanelist.user_id == User.id)
        .join(Interview, Interview.id == InterviewPanelist.interview_id)
        .outerjoin(Scorecard, and_(Scorecard.interview_id == Interview.id, Scorecard.submitted_by_id == User.id))
        .where(Interview.organization_id == org_id)
        .group_by(User.id, User.full_name)
    )
    rows = result.all()
    return [
        InterviewerPerformance(
            interviewer_id=str(row.id),
            interviewer_name=row.full_name,
            interviews_conducted=row.interviews or 0,
            avg_rating_given=round(float(row.avg_rating), 2) if row.avg_rating else None,
            scorecards_submitted=row.scorecards or 0,
        )
        for row in rows
    ]


async def get_fairness_metrics(org_id: uuid.UUID, db: AsyncSession) -> FairnessMetrics:
    """Calculates fairness/bias analytics based on real tenant data."""
    from app.models.user import User

    # 1. Pass rates by Stage
    # A candidate "passes" a stage if their application stage is in a later bucket.
    # To keep it simple, we use the broad funnel mapping and check how many people
    # reached each stage versus the previous stage.
    
    stmt_stages = select(Application.stage, func.count(Application.id)).where(Application.organization_id == org_id).group_by(Application.stage)
    rows_stages = (await db.execute(stmt_stages)).all()
    counts = {row[0]: row[1] for row in rows_stages}
    
    # Mapping exact stages to buckets
    def get_bucket(stage_val):
        if not stage_val:
            return None
        s = stage_val.lower()
        if s == 'applied': return 'Applied'
        elif s in ['screening', 'pre_screening']: return 'Shortlisted'
        elif s in ['technical_round', 'practical_round', 'techno_functional_round']: return 'Screened'
        elif s in ['management_round', 'hr_round', 'interview']: return 'Interviewed'
        elif s in ['interviewed', 'offer', 'offered', 'hired']: return 'Final Round'
        return None

    bucket_counts = {'Applied': 0, 'Shortlisted': 0, 'Screened': 0, 'Interviewed': 0, 'Final Round': 0}
    for stage, count in counts.items():
        bucket = get_bucket(stage)
        if bucket:
            bucket_counts[bucket] += count

    # "Passed" logic: people currently in Shortlisted MUST have passed Applied.
    # Therefore, total who reached Shortlisted = Shortlisted + Screened + Interviewed + Final Round
    reach_final = bucket_counts['Final Round']
    reach_inter = bucket_counts['Interviewed'] + reach_final
    reach_screen = bucket_counts['Screened'] + reach_inter
    reach_short = bucket_counts['Shortlisted'] + reach_screen
    reach_applied = bucket_counts['Applied'] + reach_short

    pass_rates_stage = [
        StagePassRate(stage="Applied -> Shortlisted", pass_rate=round(reach_short / reach_applied * 100, 1) if reach_applied > 0 else 0.0),
        StagePassRate(stage="Shortlisted -> Screened", pass_rate=round(reach_screen / reach_short * 100, 1) if reach_short > 0 else 0.0),
        StagePassRate(stage="Screened -> Interviewed", pass_rate=round(reach_inter / reach_screen * 100, 1) if reach_screen > 0 else 0.0),
        StagePassRate(stage="Interviewed -> Final", pass_rate=round(reach_final / reach_inter * 100, 1) if reach_inter > 0 else 0.0),
    ]

    # 2. Pass rates by Source
    # We join Candidate and Application, grouping by Candidate.source
    stmt_sources = select(
        Candidate.source,
        func.count(Application.id).label("total"),
        func.count(Application.id).filter(Application.stage.in_(['interviewed', 'offer', 'offered', 'hired'])).label("finalists")
    ).join(Candidate, Candidate.id == Application.candidate_id)\
     .where(Application.organization_id == org_id)\
     .group_by(Candidate.source)
    
    rows_sources = (await db.execute(stmt_sources)).all()
    pass_rates_source = []
    for row in rows_sources:
        source_name = row.source or "Unknown"
        rate = round((row.finalists / row.total) * 100, 1) if row.total > 0 else 0.0
        pass_rates_source.append(SourcePassRate(source=source_name, pass_rate=rate))

    calibration = await interviewer_calibration(org_id, db)

    return FairnessMetrics(
        pass_rates_by_stage=pass_rates_stage,
        pass_rates_by_source=pass_rates_source,
        interviewer_calibration_variance=calibration
    )


async def interviewer_calibration(org_id: uuid.UUID, db: AsyncSession) -> list[InterviewerCalibration]:
    """Each interviewer's average scorecard rating against the org's average."""
    from app.models.user import User

    # We get avg rating for each interviewer, and also the global average rating.
    stmt_global_avg = select(func.avg(Scorecard.overall_rating)).where(Scorecard.organization_id == org_id)
    global_avg = (await db.execute(stmt_global_avg)).scalar()
    global_avg = float(global_avg) if global_avg else 0.0

    stmt_perf = select(
        User.full_name,
        func.avg(Scorecard.overall_rating).label("avg_rating")
    ).join(Scorecard, Scorecard.submitted_by_id == User.id)\
     .where(Scorecard.organization_id == org_id)\
     .group_by(User.id, User.full_name)\
     .having(func.count(Scorecard.id) > 1) # Only consider interviewers with >1 scorecard for variance
     
    rows_perf = (await db.execute(stmt_perf)).all()
    calibration = []
    for row in rows_perf:
        avg_rating = float(row.avg_rating) if row.avg_rating else 0.0
        variance = round(avg_rating - global_avg, 2)
        calibration.append(InterviewerCalibration(
            interviewer_name=row.full_name,
            avg_rating_given=round(avg_rating, 2),
            global_avg_rating=round(global_avg, 2),
            variance=variance
        ))
    return calibration
