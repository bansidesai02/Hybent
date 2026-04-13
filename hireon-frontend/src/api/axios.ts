/**
 * Axios base instance with:
 * - Base URL pointing to backend
 * - Authorization header injection from Zustand store
 * - 401 auto-refresh interceptor with request retry
 */
import axios, { type AxiosRequestConfig } from 'axios'
import { useUIStore } from '@/store/uiStore'

// Extend AxiosRequestConfig to include skipLoader
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipLoader?: boolean
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // for HttpOnly refresh token cookie
})

// ── Request interceptor: inject access token & start loading ─────────────────
api.interceptors.request.use((config) => {
  // Start global loader if not skipped
  if (!config.skipLoader) {
    useUIStore.getState().startLoading()
  }

  // Import lazily to avoid circular deps
  const token = localStorage.getItem('hireon_access_token')
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
    // Stop global loader
    if (!response.config.skipLoader) {
      useUIStore.getState().stopLoading()
    }

    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        response.data = response.data.data !== undefined ? response.data.data : response.data;
      }
    }
    return response;
  },
  async (error) => {
    // Stop global loader on error too
    if (error.config && !error.config.skipLoader) {
      useUIStore.getState().stopLoading()
    }

    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
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
        const refreshToken = localStorage.getItem('hireon_refresh_token')
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
        localStorage.setItem('hireon_access_token', newToken)
        if (responseData.refresh_token) {
          localStorage.setItem('hireon_refresh_token', responseData.refresh_token)
        }

        // Update auth store
        const { useAuthStore } = await import('@/store/authStore')
        useAuthStore.getState().setTokens(newToken, responseData.refresh_token)

        processQueue(null, newToken)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('hireon_access_token')
        localStorage.removeItem('hireon_refresh_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
