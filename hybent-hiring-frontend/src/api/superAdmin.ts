import api from './axios'

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
  subscribers?: number
}

export interface PlatformSettingsPayload {
  smtp_provider?: string
  smtp_sender_name?: string
  smtp_sender_email?: string
  require_2fa?: boolean
  session_timeout?: boolean
  ip_whitelist?: boolean
  platform_name?: string
  logo_url?: string
  primary_color?: string
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
    api.post<{ org_id: string }>('/v1/super-admin/clients', payload).then(res => res.data),
  
  updateClient: (clientId: string, payload: ClientUpdatePayload) => 
    api.put<any>(`/v1/super-admin/clients/${clientId}`, payload).then(res => res.data),
  
  deleteClient: (clientId: string) => 
    api.delete<any>(`/v1/super-admin/clients/${clientId}`).then(res => res.data),
  
  suspendClient: (clientId: string) => 
    api.post<any>(`/v1/super-admin/clients/${clientId}/suspend`).then(res => res.data),
  
  activateClient: (clientId: string) => 
    api.post<any>(`/v1/super-admin/clients/${clientId}/activate`).then(res => res.data),
  
  getClientFlags: (clientId: string) => api.get<Record<string, boolean>>(`/v1/super-admin/clients/${clientId}/flags`).then(res => res.data),
  
  updateClientFlags: (clientId: string, flags: Record<string, boolean>) => 
    api.put<any>(`/v1/super-admin/clients/${clientId}/flags`, flags).then(res => res.data),
  
  getGlobalFlags: () => api.get<Record<string, boolean>>('/v1/super-admin/flags').then(res => res.data),
  
  updateGlobalFlags: (flags: Record<string, boolean>) => 
    api.put<any>('/v1/super-admin/flags', flags).then(res => res.data),
  
  getUsers: (params?: { role?: string; client?: string; limit?: number; offset?: number }) => 
    api.get<any>('/v1/super-admin/users', { params }).then(res => res.data),
  
  updateUserStatus: (userId: string, isActive: boolean) => 
    api.put<any>(`/v1/super-admin/users/${userId}/status`, null, { params: { is_active: isActive } }).then(res => res.data),
  
  resetUserPassword: (userId: string) => 
    api.post<any>(`/v1/super-admin/users/${userId}/reset-password`).then(res => res.data),
  
  getAuditLogs: (params?: { client?: string; category?: string; limit?: number; offset?: number }) => 
    api.get<any>('/v1/super-admin/audit-logs', { params }).then(res => res.data),
  
  getHealth: () => api.get<any>('/v1/super-admin/health').then(res => res.data),
  
  getSettings: () => api.get<any>('/v1/super-admin/settings').then(res => res.data),
  
  updateSettings: (payload: PlatformSettingsPayload) => 
    api.put<any>('/v1/super-admin/settings', payload).then(res => res.data),
  
  getAnalytics: () => api.get<any>('/v1/super-admin/analytics').then(res => res.data),
  
  impersonateUser: (userId: string, reason: string) => 
    api.post<any>(`/v1/super-admin/impersonate/${userId}`, { reason }).then(res => res.data),
}
