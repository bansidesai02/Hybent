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
  /** Stripe is configured: seats and top-ups are paid online. */
  payments_enabled: boolean
  /** Price of one extra seat per role for the rest of the current term, or
      null when seats can't be bought online (no plan, Custom plan, term ended). */
  seat_prices_now: Record<SeatRole, number> | null
  /** The plan renews through a Stripe subscription. */
  stripe_managed: boolean
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

export type PaymentKind = 'subscription' | 'seats' | 'topup' | 'renewal'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'canceled'

export interface PaymentLine {
  label: string
  amount_usd: number
  quantity?: number
}

export interface Payment {
  id: string
  organization_id: string
  organization_name?: string
  kind: PaymentKind
  status: PaymentStatus
  amount_usd: number
  currency: string
  description: string
  details: Record<string, unknown> & { lines?: PaymentLine[] }
  receipt_url: string | null
  /** Public /pay/<token> link (plan payment links only). */
  pay_url?: string
  expires_at: string | null
  paid_at: string | null
  created_at: string
}

/** What a client sees on the public /pay/<token> page. */
export interface PaymentLink {
  status: PaymentStatus
  organization_name: string | null
  description: string
  amount_usd: number
  currency: string
  term_months: number | null
  /** Renews every term through Stripe; false for a one-off Custom payment. */
  recurring: boolean
  lines: PaymentLine[]
  expires_at: string | null
  paid_at: string | null
}

/** Send the browser to a Stripe Checkout page. */
export const redirectToCheckout = (url: string) => {
  window.location.assign(url)
}

/** An organization admin's own subscription. Extra seats and AI credit
    top-ups are paid online with Stripe; plan changes and seat reductions are
    requests that email the Hybent team. */
export const billingApi = {
  get: () => api.get<BillingOverview>('/v1/billing').then((res) => res.data),
  requestChange: (payload: BillingChangeRequest) =>
    api.post('/v1/billing/request-change', payload).then((res) => res.data),
  /** Stripe Checkout for extra seats, charged for the rest of the current term. */
  checkoutSeats: (add: SeatCounts) =>
    api.post<{ url: string }>('/v1/billing/checkout/seats', add).then((res) => res.data),
  checkoutTopup: (credits: number) =>
    api.post<{ url: string }>('/v1/billing/checkout/topup', { credits }).then((res) => res.data),
  /** On return from Checkout: applies the payment if Stripe's webhook hasn't yet. */
  confirmCheckout: (sessionId: string) =>
    api.post<Payment>('/v1/billing/checkout/confirm', { session_id: sessionId }).then((res) => res.data),
  payments: () => api.get<Payment[]>('/v1/billing/payments').then((res) => res.data),
}

export type SeatCounts = Record<SeatRole, number>

/** The public payment link a client pays their plan on. No sign-in. */
export const paymentLinkApi = {
  get: (token: string) => api.get<PaymentLink>(`/v1/payments/${token}`).then((res) => res.data),
  checkout: (token: string) =>
    api.post<{ url: string }>(`/v1/payments/${token}/checkout`).then((res) => res.data),
  confirm: (token: string, sessionId: string) =>
    api.post<PaymentLink>(`/v1/payments/${token}/confirm`, { session_id: sessionId }).then((res) => res.data),
}
