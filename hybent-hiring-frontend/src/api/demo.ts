import api from './axios'

/** hybent.com/book-demo (app/routers/demos.py). */
export interface DemoBooking {
  name: string
  email: string
  company: string
  start_at: string
  duration_minutes: number
  timezone: string
  status: 'booked' | 'completed' | 'no_show' | 'cancelled'
  meet_link: string | null
  manage_token?: string
}

export interface DemoBookPayload {
  name: string
  email: string
  company: string
  team_size?: string
  phone?: string
  notes?: string
  start_at: string
  timezone: string
  website?: string
  elapsed_ms: number
}

export interface DemoAdminItem extends DemoBooking {
  id: string
  team_size: string | null
  phone: string | null
  notes: string | null
  admin_notes: string | null
  created_at: string
}

// The axios interceptor already unwraps { success, data } to data.
type Envelope<T> = T

export const demoApi = {
  slots: (exclude?: string) =>
    api.get<Envelope<{ slots: string[]; duration_minutes: number; host_timezone: string }>>(
      '/api/public/demo/slots', { params: exclude ? { exclude } : {}, skipLoader: true },
    ).then((r) => r.data),
  book: (payload: DemoBookPayload) =>
    api.post<Envelope<DemoBooking>>('/api/public/demo/book', payload, { skipLoader: true }).then((r) => r.data),
  manage: (token: string) =>
    api.get<Envelope<DemoBooking>>(`/api/public/demo/manage/${token}`, { skipLoader: true }).then((r) => r.data),
  reschedule: (token: string, start_at: string) =>
    api.post<Envelope<DemoBooking>>(`/api/public/demo/manage/${token}/reschedule`, { start_at }, { skipLoader: true })
      .then((r) => r.data),
  cancel: (token: string) =>
    api.post<Envelope<DemoBooking>>(`/api/public/demo/manage/${token}/cancel`, {}, { skipLoader: true }).then((r) => r.data),

  // Super admin
  list: (params: { when?: 'upcoming' | 'past' | 'all'; status?: string; search?: string }) =>
    api.get<Envelope<{ items: DemoAdminItem[]; counts: Record<string, number> }>>('/v1/super-admin/demos', { params })
      .then((r) => r.data),
  calendar: () =>
    api.get<Envelope<{ connected: boolean; account: string | null }>>('/v1/super-admin/demos/calendar').then((r) => r.data),
  sendLink: (id: string, meet_link: string) =>
    api.post<Envelope<DemoAdminItem>>(`/v1/super-admin/demos/${id}/send-link`, { meet_link }).then((r) => r.data),
  update: (id: string, body: { status?: string; admin_notes?: string }) =>
    api.patch<Envelope<DemoAdminItem>>(`/v1/super-admin/demos/${id}`, body).then((r) => r.data),
}

/** The server's message for a failed request, or a fallback. */
export function demoError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as { response?: { data?: { detail?: string; message?: string; error?: { message?: string } } } }
  return e?.response?.data?.detail || e?.response?.data?.error?.message || e?.response?.data?.message || fallback
}
