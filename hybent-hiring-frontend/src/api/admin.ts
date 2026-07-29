import api from './axios'
import type { User, PaginatedResponse, AuditLog } from '@/types'

export const adminApi = {
  listUsers: () => api.get<User[]>('/v1/users'),

  inviteUser: (data: { email: string; full_name: string; role: string; password: string }) =>
    api.post<User>('/v1/users/invite', data),

  updateUser: (id: string, data: Partial<User>) => api.put<User>(`/v1/users/${id}`, data),

  deleteUser: (id: string) => api.delete<User>(`/v1/users/${id}`),

  getDesignationOrder: (userId: string) =>
    api.get<{ order: string[] }>(`/v1/users/${userId}/designation-order`),

  updateDesignationOrder: (userId: string, order: string[]) =>
    api.put<{ order: string[] }>(`/v1/users/${userId}/designation-order`, { order }),

  auditLogs: (params?: {
    page?: number
    limit?: number
    action?: string
    resource_type?: string
    resource_id?: string
    search?: string
    date_from?: string
    date_to?: string
  }) =>
    api.get<PaginatedResponse<AuditLog>>('/v1/admin/audit-logs', { params }),

  stats: () => api.get('/v1/admin/stats'),
}
