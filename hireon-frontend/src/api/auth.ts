import api from './axios'
import type { AuthResponse, User } from '@/types'

export const authApi = {
  register: (data: {
    full_name: string
    email: string
    password: string
    organization_name: string
    organization_slug: string
  }) => api.post<AuthResponse>('/v1/auth/register', data),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/v1/auth/login', { email, password }),

  logout: (refresh_token?: string) =>
    api.post('/v1/auth/logout', refresh_token ? { refresh_token } : {}),

  me: () => api.get<User>('/v1/auth/me'),

  changePassword: (current_password: string, new_password: string) =>
    api.put('/v1/auth/me/password', { current_password, new_password }),

  connectCalendar: () => api.get<{ auth_url: string }>('/v1/calendar/auth'),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/v1/auth/forgot-password', { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/v1/auth/reset-password', { token, new_password }),

  sendCandidateMagicLink: (email: string) =>
    api.post<{ message: string }>('/v1/auth/candidate/magic-link', { email }),

  /** Delete the current user's profile permanently */
  deleteMe: () => api.delete('/v1/users/me'),
}

// ── Profile API (GET + PUT /v1/users/me) ──────────────────────────────────────
export interface ProfileUpdatePayload {
  full_name?: string
  avatar_url?: string
  phone?: string
  // Admin-only fields:
  email?: string
  role?: string
  organization_name?: string
}

export const profileApi = {
  /** Fetch the current user's full profile */
  getMe: () => api.get<User>('/v1/users/me'),

  /** Update full_name and/or avatar_url */
  updateMe: (data: ProfileUpdatePayload) =>
    api.put<User>('/v1/users/me', data),

  /** Upload a new avatar image (multipart/form-data) */
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<User>('/v1/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** Delete the current avatar image */
  deleteAvatar: () => api.delete<User>('/v1/users/me/avatar'),
}
