/**
 * Axios base instance with:
 * - Base URL pointing to backend
 * - Authorization header injection from Zustand store
 * - 401 auto-refresh interceptor with request retry
 */
import axios, { type AxiosRequestConfig } from 'axios'
import { tokenStorage } from '@/utils/tokenStorage'

// Extend AxiosRequestConfig to include skipLoader
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipLoader?: boolean
  }
}

import { getApiBaseUrl } from '@/config/api'

const BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // for HttpOnly refresh token cookie
})


// ── Request interceptor: inject access token & start loading ─────────────────
api.interceptors.request.use((config) => {
  // Import lazily to avoid circular deps
  const token = tokenStorage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Dispatched on window when a request is refused because the free trial ended. */
export const TRIAL_EXPIRED_EVENT = 'hb:trial-expired'

// ── Response interceptor: auto-refresh on 401 & stop loading ─────────────────
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token as string)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        response.data = response.data.data !== undefined ? response.data.data : response.data;
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    const isAuthRouteToSkip = originalRequest.url && (
      originalRequest.url.includes('/v1/auth/login') ||
      originalRequest.url.includes('/v1/auth/register') ||
      originalRequest.url.includes('/v1/auth/refresh') ||
      originalRequest.url.includes('/v1/auth/forgot-password') ||
      originalRequest.url.includes('/v1/auth/reset-password') ||
      originalRequest.url.includes('/v1/auth/candidate/magic-link') ||
      originalRequest.url.includes('/v1/auth/2fa/') ||
      originalRequest.url.includes('/v1/auth/google')
    )

    // The organization's free trial ended (trial_service on the server):
    // TrialBanner shows the upgrade/export screen at once.
    if ((error.response?.status === 402 || error.response?.status === 403) &&
        error.response?.data?.details?.code === 'trial_expired') {
      window.dispatchEvent(new Event(TRIAL_EXPIRED_EVENT))
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRouteToSkip) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`
          }
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      try {
        const newToken = await refreshAccessToken()
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Exchange the refresh token for a new access token and store it. Concurrent
 * callers wait for the one refresh in flight. Requests made outside axios
 * (e.g. the Copilot's streaming fetch) call this themselves on a 401.
 */
export async function refreshAccessToken(): Promise<string> {
  // A support session's token is never refreshed: the refresh would come back
  // as the super admin's own account. When it stops working, the session is over.
  const { useAuthStore: authStore } = await import('@/store/authStore')
  if (authStore.getState().user?.is_impersonating) {
    const { leaveSupportSession } = await import('@/utils/impersonation')
    void leaveSupportSession('expired', 'Your support session has ended.')
    throw new Error('Support session ended')
  }

  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject })
    })
  }
  isRefreshing = true
  try {
    // Try cookie-based refresh first, then localStorage fallback
    const refreshToken = tokenStorage.getRefreshToken()
    const payload = refreshToken ? { refresh_token: refreshToken } : undefined

    const { data } = await axios.post(
      `${BASE_URL}/v1/auth/refresh`,
      payload,
      {
        withCredentials: true,
        skipLoader: true // Don't show loader for refresh token calls
      }
    )

    // Handle the new APIResponse format
    const responseData = data.success !== undefined && data.data !== undefined ? data.data : data;

    const newToken = responseData.access_token

    // Update auth store
    const { useAuthStore } = await import('@/store/authStore')
    const rememberMe = useAuthStore.getState().rememberMe
    tokenStorage.setTokens(newToken, responseData.refresh_token, rememberMe)
    useAuthStore.getState().setTokens(newToken, responseData.refresh_token)

    processQueue(null, newToken)
    return newToken
  } catch (refreshError: any) {
    processQueue(refreshError, null)

    try {
      const { useAuthStore } = await import('@/store/authStore')

      const status = refreshError?.response?.status
      const detail: string = refreshError?.response?.data?.detail ||
        refreshError?.response?.data?.message || ''

      if (status === 403 || detail.toLowerCase().includes('inactive') || detail.toLowerCase().includes('not found')) {
        useAuthStore.getState().setForcedLogout('account_deleted')
      } else {
        useAuthStore.getState().setForcedLogout('session_expired')
      }
    } catch (e) {}

    throw refreshError
  } finally {
    isRefreshing = false
  }
}

export default api
