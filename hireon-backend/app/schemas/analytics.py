from pydantic import BaseModel


class FunnelStage(BaseModel):
    stage: str
    count: int
    percentage: float


class AnalyticsOverview(BaseModel):
    total_jobs: int
    active_jobs: int
    total_applications: int
    total_candidates: int
    resumes_processed: int = 0
    auto_shortlisted: int = 0
    interviews_scheduled: int
    offers_sent: int
    offers_accepted: int
    avg_match_score: float | None = None
    time_to_hire_days: float | None = None
    # % change vs previous 30-day window — None when no prior data exists
    total_applications_delta: float | None = None
    total_candidates_delta: float | None = None
    resumes_processed_delta: float | None = None
    auto_shortlisted_delta: float | None = None
    interviews_scheduled_delta: float | None = None
    offers_accepted_delta: float | None = None


class FunnelData(BaseModel):
    job_id: str | None = None
    stages: list[FunnelStage]


class ScoreDistributionBucket(BaseModel):
    range: str   # e.g. "80-100"
    count: int


class TimeToHireData(BaseModel):
    month: str
    avg_days: float


class InterviewerPerformance(BaseModel):
    interviewer_id: str
    interviewer_name: str
    interviews_conducted: int
    avg_rating_given: float | None = None
    scorecards_submitted: int


class StagePassRate(BaseModel):
    stage: str
    pass_rate: float


class SourcePassRate(BaseModel):
    source: str
    pass_rate: float


class InterviewerCalibration(BaseModel):
    interviewer_name: str
    avg_rating_given: float
    global_avg_rating: float
    variance: float


class FairnessMetrics(BaseModel):
    pass_rates_by_stage: list[StagePassRate]
    pass_rates_by_source: list[SourcePassRate]
    interviewer_calibration_variance: list[InterviewerCalibration]

