/**
 * Keeps every open copy of the site on the latest deploy.
 *
 * The service worker checks for a new version on load, when the tab comes back
 * and every 30 minutes. When a new one takes over, public pages reload at once.
 * Inside the signed-in app a reload could lose a half-filled form, so it waits
 * until the visitor has left the tab and come back.
 */
const CHECK_EVERY = 30 * 60 * 1000
const MIN_GAP = 5 * 60 * 1000
const RELOADED_AT = 'hb-sw-reloaded-at'

const inApp = () => /^\/(hiring|dashboard)(\/|$)/.test(window.location.pathname)

function reloadOnce() {
  try {
    // A worker that keeps replacing itself must not cause a reload loop.
    const last = Number(sessionStorage.getItem(RELOADED_AT) || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch { /* private mode: reload anyway */ }
  window.location.reload()
}

export function startAutoUpdate() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker

  // On a first visit the worker claims the page too, with nothing new to show.
  const hadWorker = !!sw.controller
  let updated = false
  sw.addEventListener('controllerchange', () => {
    if (!hadWorker || updated) return
    updated = true
    if (!inApp()) { reloadOnce(); return }
    const whenBack = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', whenBack)
      reloadOnce()
    }
    document.addEventListener('visibilitychange', whenBack)
  })

  let lastCheck = 0
  const check = () => {
    if (Date.now() - lastCheck < MIN_GAP) return
    lastCheck = Date.now()
    sw.getRegistration('/').then((reg) => {
      if (reg && new URL(reg.scope).pathname === '/') return reg.update()
    }).catch(() => undefined)
  }
  window.addEventListener('load', check)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.setInterval(() => { lastCheck = 0; check() }, CHECK_EVERY)
}
