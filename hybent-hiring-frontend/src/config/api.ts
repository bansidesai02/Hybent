export const PROD_BACKEND_URL = 'https://hybent-hiring-backend.onrender.com'

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '')
  }
  // Fallback for production builds or when hosted on hybent.com domain
  if (import.meta.env.PROD || (typeof window !== 'undefined' && (window.location.hostname.includes('hybent.com') || window.location.hostname.includes('netlify.app')))) {
    return PROD_BACKEND_URL
  }
  return ''
}

export const BASE_URL = getApiBaseUrl()
