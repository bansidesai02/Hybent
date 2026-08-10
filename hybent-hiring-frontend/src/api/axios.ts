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
      originalRequest.url.includes('/v1/auth/candidate/magic-link')
    )

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

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return api(originalRequest)
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

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
