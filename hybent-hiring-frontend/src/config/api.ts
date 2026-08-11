export const PROD_BACKEND_URL = 'https://hybent-hiring-backend.onrender.com'

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // If on localhost or local network IP, return empty string so local Nginx / Vite proxy handles requests locally
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return ''
    }
    if (host.includes('hybent.com') || host.includes('netlify.app') || host.includes('onrender.com')) {
      return PROD_BACKEND_URL
    }
  }

  if (import.meta.env.PROD) {
    return PROD_BACKEND_URL
  }

  return ''
}

export const BASE_URL = getApiBaseUrl()
