import api from './axios'
import type { AnalyticsOverview, FunnelData, ScoreDistributionBucket, InterviewerPerformance, FairnessMetrics } from '@/types'

export const analyticsApi = {
  overview: () => api.get<AnalyticsOverview>('/v1/analytics/overview'),

  funnel: (jobId?: string) =>
    api.get<FunnelData>('/v1/analytics/funnel', { params: jobId ? { job_id: jobId } : {} }),

  scoreDistribution: () =>
    api.get<ScoreDistributionBucket[]>('/v1/analytics/score-distribution'),

  interviewerPerformance: () =>
    api.get<InterviewerPerformance[]>('/v1/analytics/interviewer-performance'),

  fairness: () => api.get<FairnessMetrics>('/v1/analytics/fairness'),

  /** Everything the AI Insights page shows, from live pipeline data. */
  insights: (jobId?: string) =>
    api.get<Insights>('/v1/analytics/insights', { params: jobId ? { job_id: jobId } : {} }),
}

export interface Insights {
  job_id: string | null
  total_applications: number
  hires: number
  avg_match_score: number | null
  time_to_hire_days: number | null
  funnel: Array<{ step: string; count: number; percentage: number }>
  pass_rates: Array<{ from_step: string; to_step: string; pass_rate: number; entered: number }>
  sources: Array<{ source: string; applications: number; reached_interview: number; rate: number }>
  top_skills: Array<{ skill: string; count: number }>
  candidates_in_scope: number
  talent_matches: number
  interviewer_calibration: Array<{
    interviewer_name: string
    avg_rating_given: number
    global_avg_rating: number
    variance: number
  }>
  highlights: string[]
}
