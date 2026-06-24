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

export const superAdminApi = {
  getDashboard: () => api.get<any>('/v1/super-admin/dashboard').then(res => res.data),
  
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
