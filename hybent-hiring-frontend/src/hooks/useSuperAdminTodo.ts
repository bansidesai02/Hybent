import { useQuery } from '@tanstack/react-query'

import api from '@/api/axios'

/** What needs a super admin right now, as counts (dashboard card, nav badges, tab counts). */
export interface SuperAdminTodo {
  trials_pending: number
  demo_requests_new: number
  demos_upcoming: number
  contact_new: number
  emails_failed: number
  errors_open: number
  sessions_active: number
  leads: number
  system: number
}

export const SUPER_ADMIN_TODO_KEY = ['super-admin', 'todo']

export function useSuperAdminTodo(enabled = true) {
  return useQuery({
    queryKey: SUPER_ADMIN_TODO_KEY,
    queryFn: () => api.get<SuperAdminTodo>('/v1/super-admin/todo', { skipLoader: true }).then((r) => r.data),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })
}
