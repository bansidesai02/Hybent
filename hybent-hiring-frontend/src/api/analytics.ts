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
}
