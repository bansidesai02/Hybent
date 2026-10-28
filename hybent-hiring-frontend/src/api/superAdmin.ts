import api from './axios'
import type { Payment, PaymentLine } from './billing'
import type { User } from '@/types'

export interface ClientCreatePayload {
  name: string
  slug: string
  industry?: string
  size?: string
  location?: string
  admin_email: string
  plan_name?: string
  billing_cycle?: string
  trial_days?: number
  flags?: Record<string, boolean>
  admin_name?: string
  /** Sell the plan through a Stripe payment link: the workspace and admin
      stay inactive until it's paid (no trial). */
  collect_payment?: boolean
  extra_admin_seats?: number
  extra_recruiter_seats?: number
  /** Custom plans only: the agreed price and term. */
  custom_amount_usd?: number
  custom_term_months?: number
  send_payment_email?: boolean
}

export interface ClientCreateResult {
  org_id: string
  /** Set when the client pays by link. */
  payment?: Payment
  emailed?: boolean
}

/** A plan payment link: the plan plus extra seats, or a Custom plan's agreed price. */
export interface PaymentLinkPayload {
  plan_name: string
  extra_admin_seats?: number
  extra_recruiter_seats?: number
  custom_amount_usd?: number
  custom_term_months?: number
  send_email?: boolean
}

export interface PaymentQuote {
  term_months: number
  /** Renews every term through Stripe; false for a one-off Custom payment. */
  recurring: boolean
  amount_usd: number
  lines: PaymentLine[]
  /** Stripe is configured, so links can be created. */
  payments_enabled: boolean
}

export interface ClientUpdatePayload {
  name?: string
  industry?: string
  size?: string
  location?: string
  is_active?: boolean
  plan_name?: string
  /** $15/month and +1,500 AI credits each. */
  extra_admin_seats?: number
  /** $10/month and +1,000 AI credits each. */
  extra_recruiter_seats?: number
}

export interface PlanInfo {
  id: string
  name: string
  term_months: number | null
  is_custom: boolean
  price_monthly: number
  currency: string
  billed_amount: number | null
  billed_label: string
  discount_pct: number | null
  included_admins: number
  included_recruiters: number
  ai_credits_monthly: number
  /** The plan includes the Recruiter Copilot (Pro and Custom). */
  copilot: boolean
  subscribers?: number
}

export interface PlatformSettingsPayload {
  smtp_provider?: string
  smtp_sender_name?: string
  smtp_sender_email?: string
  require_2fa?: boolean
  session_timeout?: boolean
  ip_whitelist?: boolean
  /** IPs / CIDR ranges allowed when ip_whitelist is on. */
  ip_allowlist?: string[]
  platform_name?: string
  logo_url?: string
  primary_color?: string
}

export interface UserDirectoryParams {
  role?: string
  /** Legacy: organization name. Prefer organization_id. */
  client?: string
  organization_id?: string
  q?: string
  status?: 'all' | 'active' | 'suspended'
  last_login?: 'all' | '7d' | '30d' | 'stale_30d' | 'never'
  sort?: 'created_at' | 'last_login' | 'name' | 'email'
  direction?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface AuditLogParams {
  category?: string
  q?: string
  module?: string
  actor?: string
  organization_id?: string
  date_from?: string
  date_to?: string
}

export interface LoginEvent {
  id: string
  email: string
  user_id: string | null
  organization_id: string | null
  /** password | google | otp */
  method: string
  success: boolean
  /** bad_credentials, user_suspended, org_suspended, ip_not_allowed, mfa_required, bad_otp, no_account */
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface ClientMember {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  is_verified: boolean
  last_login: string | null
  created_at: string
}

export interface ClientOverview {
  organization: {
    id: string
    name: string
    slug: string
    industry: string | null
    size: string | null
    website: string | null
    is_active: boolean
    created_at: string
    /** Holds super admin accounts: can't be suspended or deleted. */
    is_platform_org: boolean
  }
  subscription: {
    plan: string
    status: string
    max_jobs: number
    seats_limit: number
    trial_end: string | null
    current_period_end: string | null
    mrr: number
  } | null
  members: ClientMember[]
  member_counts: { active: number; suspended: number; never_signed_in: number }
  hiring: {
    jobs: number
    open_jobs: number
    candidates: number
    candidates_30d: number
    applications: number
    interviews: number
    interviews_30d: number
  }
  last_login: string | null
  last_activity_at: string | null
  imports: Array<{
    id: string
    file_name: string
    status: string
    total_rows: number
    success_count: number
    failed_count: number
    duplicate_count: number
    created_at: string
  }>
  activity: Array<{
    id: string
    action: string
    resource_type: string
    actor: string | null
    /** Set when a super admin did it through a support session. */
    impersonated_by: string | null
    created_at: string
  }>
  logins: LoginEvent[]
  flags: Record<string, boolean>
}

export interface SupportSessionStart {
  access_token: string
  token_type: string
  session: { id: string; expires_at: string; allow_changes: boolean; minutes: number }
  user: User
}

export interface SupportSessionRow {
  id: string
  super_admin_email: string | null
  target: { id: string; email: string; full_name: string; role: string } | null
  organization_id: string | null
  organization: string | null
  reason: string
  allow_changes: boolean
  started_at: string
  expires_at: string | null
  ended_at: string | null
  /** exit | expired | replaced | ended_by_admin; null while active or for untracked old sessions */
  end_reason: string | null
  ended_by_email: string | null
  /** unknown = started before sessions were tracked; its end was never recorded */
  status: 'active' | 'ended' | 'unknown'
  /** Audited change records made during the session. */
  changes: number | null
}

export interface OrgActivityRow {
  organization_id: string
  name: string
  is_active: boolean
  logins: number
  active_users: number
  actions: number
  candidates_added: number
  interviews_scheduled: number
  last_login: string | null
  last_activity_at: string | null
  score: number
}

export interface ActivityRankings {
  days: number
  organizations: OrgActivityRow[]
  recent_users: Array<{ id: string; full_name: string; email: string; role: string; last_login: string; client: string | null }>
  /** When sign-in recording began; null if nothing recorded yet. */
  login_tracking_since: string | null
}

export interface OrgAICredits {
  organization_id: string
  organization_name: string
  plan: string | null
  monthly_credits: number | null
  custom_monthly_credits: number | null
  used_credits: number
  purchased_credits: number
  reset_at: string | null
  provider_cost_usd: number
  credits_value_usd: number
}

export interface OrgAICreditsUpdate {
  /** Custom monthly allowance; null returns the org to its plan's allowance. */
  monthly_credits?: number | null
  /** Paid top-up credits to add. */
  add_purchased?: number
}

export const superAdminApi = {
  getDashboard: () => api.get<any>('/v1/super-admin/dashboard').then(res => res.data),

  getPlans: () => api.get<PlanInfo[]>('/v1/super-admin/plans').then(res => res.data),

  getAICredits: () => api.get<OrgAICredits[]>('/v1/super-admin/ai-credits').then(res => res.data),
  updateAICredits: (orgId: string, payload: OrgAICreditsUpdate) =>
    api.put<any>(`/v1/super-admin/organizations/${orgId}/ai-credits`, payload).then(res => res.data),
  
  getClients: () => api.get<any[]>('/v1/super-admin/clients').then(res => res.data),
  
  createClient: (payload: ClientCreatePayload) => 
    api.post<ClientCreateResult>('/v1/super-admin/clients', payload).then(res => res.data),

  quotePaymentLink: (payload: PaymentLinkPayload) =>
    api.post<PaymentQuote>('/v1/super-admin/payments/quote', payload, { skipLoader: true }).then(res => res.data),
  createPaymentLink: (clientId: string, payload: PaymentLinkPayload) =>
    api.post<Payment & { emailed: boolean }>(`/v1/super-admin/clients/${clientId}/payment-links`, payload).then(res => res.data),
  getPayments: (organizationId?: string) =>
    api.get<Payment[]>('/v1/super-admin/payments', { params: organizationId ? { organization_id: organizationId } : {} }).then(res => res.data),
  cancelPayment: (paymentId: string) =>
    api.post<Payment>(`/v1/super-admin/payments/${paymentId}/cancel`).then(res => res.data),
  resendPayment: (paymentId: string) =>
    api.post<any>(`/v1/super-admin/payments/${paymentId}/resend`).then(res => res.data),
  
  updateClient: (clientId: string, payload: ClientUpdatePayload) => 
    api.put<any>(`/v1/super-admin/clients/${clientId}`, payload).then(res => res.data),
  
  deleteClient: (clientId: string) => 
    api.delete<any>(`/v1/super-admin/clients/${clientId}`).then(res => res.data),
  
  suspendClient: (clientId: string) => 
    api.post<any>(`/v1/super-admin/clients/${clientId}/suspend`).then(res => res.data),
  
  activateClient: (clientId: string) => 
    api.post<any>(`/v1/super-admin/clients/${clientId}/activate`).then(res => res.data),
  
  getClientFlags: (clientId: string) => api.get<Record<string, boolean>>(`/v1/super-admin/clients/${clientId}/flags`).then(res => res.data),
  
  /** `force` turns on the Copilot for a plan that doesn't include it (Standard). */
  updateClientFlags: (clientId: string, flags: Record<string, boolean>, force = false) =>
    api.put<any>(`/v1/super-admin/clients/${clientId}/flags`, flags, { params: force ? { force: true } : undefined }).then(res => res.data),

  /** What the client's plan includes: the Copilot is Pro-only unless forced. */
  getClientPlanFeatures: (clientId: string) =>
    api.get<{ plan_name: string | null; copilot_in_plan: boolean }>(`/v1/super-admin/clients/${clientId}/plan-features`).then(res => res.data),
  
  getGlobalFlags: () => api.get<Record<string, boolean>>('/v1/super-admin/flags').then(res => res.data),
  
  updateGlobalFlags: (flags: Record<string, boolean>) => 
    api.put<any>('/v1/super-admin/flags', flags).then(res => res.data),
  
  getUsers: (params?: UserDirectoryParams) =>
    api.get<any>('/v1/super-admin/users', { params }).then(res => res.data),

  getClientOverview: (clientId: string) =>
    api.get<ClientOverview>(`/v1/super-admin/clients/${clientId}/overview`).then(res => res.data),

  getUserLogins: (userId: string) =>
    api.get<{ user: { id: string; email: string; full_name: string; last_login: string | null }; events: LoginEvent[] }>(
      `/v1/super-admin/users/${userId}/logins`,
    ).then(res => res.data),

  getLoginEvents: (params?: { organization_id?: string; q?: string; outcome?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }) =>
    api.get<{ events: Array<LoginEvent & { organization: string | null }>; total: number }>(
      '/v1/super-admin/login-events', { params },
    ).then(res => res.data),

  getActivity: (days: number) =>
    api.get<ActivityRankings>('/v1/super-admin/activity', { params: { days } }).then(res => res.data),

  /** The filtered audit trail as a CSV file (the export is itself audited). */
  exportAuditLogs: (params?: AuditLogParams) =>
    api.get<Blob>('/v1/super-admin/audit-logs/export', { params, responseType: 'blob' }).then(res => res.data),
  
  updateUserStatus: (userId: string, isActive: boolean) => 
    api.put<any>(`/v1/super-admin/users/${userId}/status`, null, { params: { is_active: isActive } }).then(res => res.data),
  
  resetUserPassword: (userId: string) => 
    api.post<any>(`/v1/super-admin/users/${userId}/reset-password`).then(res => res.data),
  
  getAuditLogs: (params?: AuditLogParams & { limit?: number; offset?: number }) =>
    api.get<any>('/v1/super-admin/audit-logs', { params }).then(res => res.data),
  
  getHealth: () => api.get<any>('/v1/super-admin/health').then(res => res.data),
  
  getSettings: () => api.get<any>('/v1/super-admin/settings').then(res => res.data),
  
  updateSettings: (payload: PlatformSettingsPayload) => 
    api.put<any>('/v1/super-admin/settings', payload).then(res => res.data),
  
  getAnalytics: () => api.get<any>('/v1/super-admin/analytics').then(res => res.data),
  
  /** Start a time-limited support session as this user (view only unless allowChanges). */
  impersonateUser: (userId: string, reason: string, allowChanges = false) =>
    api.post<SupportSessionStart>(`/v1/super-admin/impersonate/${userId}`, { reason, allow_changes: allowChanges })
      .then(res => res.data),

  /** End a support session: its token stops working at once. Safe to call twice. */
  endImpersonation: (sessionId: string, reason: 'exit' | 'expired' = 'exit') =>
    api.post<SupportSessionRow>(`/v1/super-admin/impersonations/${sessionId}/end`, { reason }, { skipLoader: true })
      .then(res => res.data),

  getImpersonations: (params?: { status?: 'all' | 'active' | 'ended'; organization_id?: string; limit?: number; offset?: number }) =>
    api.get<{ sessions: SupportSessionRow[]; total: number; minutes: number }>('/v1/super-admin/impersonations', { params })
      .then(res => res.data),
}

// ── Free trial requests (/v1/super-admin/trials) ─────────────────────────────

export type TrialRequestStatus = 'pending' | 'rejected' | 'active' | 'expired' | 'converted' | 'purged'

export interface TrialRequest {
  id: string
  company_name: string
  company_website: string
  company_domain: string
  company_linkedin_url: string
  company_size: string
  industry: string
  country: string
  hires_per_year: string | null
  contact_name: string
  contact_title: string
  contact_email: string
  contact_phone: string
  contact_linkedin_url: string
  hiring_needs: string | null
  plan_interest: 'standard' | 'pro'
  ip_address: string | null
  risk_flags: string[]
  status: TrialRequestStatus
  reviewed_at: string | null
  rejection_reason: string | null
  admin_notes: string | null
  organization_id: string | null
  trial_start: string | null
  trial_end: string | null
  data_purge_at: string | null
  reminder_1d_sent_at: string | null
  reminder_1h_sent_at: string | null
  converted_at: string | null
  purged_at: string | null
  created_at: string
  usage?: { users: number; jobs: number; candidates: number } | null
  email_verified_at?: string | null
  setup_completed_at?: string | null
  messages?: TrialReplyMessage[]
}

export type TrialReplyKind = 'approve' | 'reject' | 'info'

export interface TrialReplyMessage {
  id: string
  kind: TrialReplyKind
  to_email: string
  subject: string
  body: string
  ai_generated: boolean
  delivered: boolean
  sent_by_email: string | null
  created_at: string
}

export interface TrialRequestList {
  items: TrialRequest[]
  total: number
  page: number
  page_size: number
  counts: Record<TrialRequestStatus, number>
}

export const trialsApi = {
  list: (params: { status?: string; search?: string; page?: number; page_size?: number }) =>
    api.get<TrialRequestList>('/v1/super-admin/trials', { params, skipLoader: true }).then((res) => res.data),
  get: (id: string) => api.get<TrialRequest>(`/v1/super-admin/trials/${id}`).then((res) => res.data),
  /** An AI (or template) email for the team to edit; call again to regenerate. */
  draft: (id: string, kind: TrialReplyKind, instructions = '') =>
    api.post<{ subject: string; body: string; ai_generated: boolean }>(
      `/v1/super-admin/trials/${id}/draft`, { kind, instructions }, { skipLoader: true },
    ).then((res) => res.data),
  /** Sends from info@hybent.com. "approve" starts the trial and adds the setup link. */
  send: (id: string, payload: { kind: TrialReplyKind; subject: string; body: string; ai_generated: boolean; reason?: string }) =>
    api.post<TrialRequest & { email_sent: boolean }>(`/v1/super-admin/trials/${id}/send`, payload).then((res) => res.data),
  extend: (id: string, days: number) =>
    api.post<TrialRequest>(`/v1/super-admin/trials/${id}/extend`, { days }).then((res) => res.data),
  saveNotes: (id: string, admin_notes: string) =>
    api.put<TrialRequest>(`/v1/super-admin/trials/${id}/notes`, { admin_notes }).then((res) => res.data),
}
