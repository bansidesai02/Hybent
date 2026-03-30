import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getMessaging, getToken, onMessage, type Unsubscribe } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyAIK4xKoyDyUr_1plCvs-pbMgHVisyQtSg',
  authDomain: 'hireon-6e1f8.firebaseapp.com',
  projectId: 'hireon-6e1f8',
  storageBucket: 'hireon-6e1f8.firebasestorage.app',
  messagingSenderId: '277744446068',
  appId: '1:277744446068:web:2e55885ff0e9d137f6bf21',
  measurementId: 'G-NJNB9B90PP',
}

export const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)
export const messaging = getMessaging(app)

export interface MessagePayload {
  notification?: {
    title?: string
    body?: string
    icon?: string
  }
  data?: Record<string, string>
  [key: string]: unknown
}

/**
 * Request notification permission, register the FCM service worker, and
 * retrieve the FCM registration token.
 *
 * The explicit SW registration is REQUIRED for background / closed-tab push
 * notifications — without it Firebase has no service worker to wake up.
 */
export async function requestNotificationPermission(vapidKey: string): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('[FCM] Service workers not supported in this browser.')
      return null
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied.')
      return null
    }

    // Explicitly register the service worker so Firebase can wake it for
    // background messages (other tab open, app closed, screen locked, etc.)
    const swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/' }
    )
    await navigator.serviceWorker.ready

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    })
    console.log('[FCM] Token:', token)
    return token
  } catch (error) {
    console.error('[FCM] Error getting token:', error)
    return null
  }
}

/**
 * Listen for foreground push messages. Returns an unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: MessagePayload) => void
): Unsubscribe {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return onMessage(messaging, callback as any)
}
