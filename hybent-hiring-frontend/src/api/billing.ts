import api from './axios'
import type { PlanInfo } from './superAdmin'

export interface BillingOverview {
  subscription: {
    plan: PlanInfo
    status: string
    current_period_start: string | null
    current_period_end: string | null
    trial_end: string | null
    /** Seats per role: the plan's included ones plus that role's extra seats.
        An admin can't use a recruiter seat or the other way round. */
    seats: {
      included_admins: number
      included_recruiters: number
      extra_admin_seats: number
      extra_recruiter_seats: number
      admins_allowed: number
      recruiters_allowed: number
      admins_over: number
      recruiters_over: number
    }
  } | null
  seats_used: { admins: number; recruiters: number }
  ai_credits: { monthly: number; used: number; purchased: number; reset_at: string | null }
  plans: PlanInfo[]
  /** Price per month and AI credits added to the pool, for one extra seat of each role. */
  extra_seats: Record<SeatRole, ExtraSeatPrice>
  /** Plan rate plus extra seats, per month. */
  monthly_total_usd: number | null
}

export type SeatRole = 'admin' | 'recruiter'

export interface ExtraSeatPrice {
  price_usd: number
  ai_credits: number
}

export interface BillingChangeRequest {
  plan_name?: string
  extra_admin_seats?: number
  extra_recruiter_seats?: number
  note?: string
}

/** An organization admin's own subscription. Changes are requests: they email
    the Hybent team, who invoice and apply them. */
export const billingApi = {
  get: () => api.get<BillingOverview>('/v1/billing').then((res) => res.data),
  requestChange: (payload: BillingChangeRequest) =>
    api.post('/v1/billing/request-change', payload).then((res) => res.data),
}
