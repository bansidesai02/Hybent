import api from '@/api/axios'

/**
 * Phone notifications for admins (Web Push), browser side.
 *
 * Nothing here runs on its own: permission is only requested when the admin
 * taps "Turn on" (enablePush), which is what keeps this from becoming the
 * permission pop-up the old Firebase push was removed for.
 */

const SW_URL = '/push-sw.js'
const SW_SCOPE = '/push-sw/'

export interface PushConfig {
  enabled: boolean
  public_key: string | null
  devices: number
  events: string[]
}

/** other-account: on in this browser, but registered to another account that signed in here. */
export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'other-account' | 'on'

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const getPushConfig = () => api.get<PushConfig>('/v1/push/config', { skipLoader: true }).then((r) => r.data)

/** The push worker's registration. getRegistration() matches by longest scope,
 *  so with no push worker yet it returns the app's caching worker (scope "/"),
 *  which has no push handler: a subscription there receives but never shows. */
async function registration() {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  return reg && new URL(reg.scope).pathname === SW_SCOPE ? reg : null
}

/** Drop a subscription an earlier version made on the caching worker. */
async function removeMisplacedSubscription() {
  const main = await navigator.serviceWorker.getRegistration('/')
  if (!main || new URL(main.scope).pathname === SW_SCOPE) return
  const sub = await main.pushManager.getSubscription()
  if (!sub) return
  await api.post('/v1/push/unsubscribe', { endpoint: sub.endpoint }, { skipLoader: true }).catch(() => undefined)
  await sub.unsubscribe().catch(() => undefined)
}

/** Where this device stands, without asking the user anything. */
export async function getPushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return 'off'
  // The browser only knows it is subscribed; the API knows for which account.
  try {
    const { data } = await api.post<{ mine: boolean }>('/v1/push/check', { endpoint: sub.endpoint }, { skipLoader: true })
    return data.mine ? 'on' : 'other-account'
  } catch {
    return 'on'
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(bytes.length))
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i)
  return out
}

/** Our push worker's own activation (`serviceWorker.ready` is the page's worker, which the dev server doesn't run). */
function activated(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve()
  const worker = reg.installing ?? reg.waiting
  return new Promise((resolve) => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'activated') resolve()
    })
  })
}

/** Ask permission (only here) and register this device with the API. */
export async function enablePush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications were not allowed for this site.')

  const reg = (await registration()) ?? (await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }))
  await activated(reg)
  await removeMisplacedSubscription()
  let sub = await reg.pushManager.getSubscription()
  if (sub) {
    // A subscription made with another server key can't receive ours.
    const current = sub.options.applicationServerKey
    const want = keyBytes(publicKey)
    const same =
      current && new Uint8Array(current).length === want.length && new Uint8Array(current).every((b, i) => b === want[i])
    if (!same) {
      await sub.unsubscribe()
      sub = null
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
  const json = sub.toJSON()
  await api.post('/v1/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
}

export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await api.post('/v1/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined)
  await sub.unsubscribe()
}

export const sendTestPush = () => api.post<{ message: string }>('/v1/push/test')
