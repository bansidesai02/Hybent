/* Hybent phone notifications (Web Push) — push only.
 *
 * Registered by src/utils/push.ts under its own scope (/push-sw/), apart from
 * the app's caching worker (src/firebase-messaging-sw.ts), so it works the
 * same on the dev server and in production and can't affect page caching.
 *
 * A device gets push only after an admin taps "Turn on" in Settings, and the
 * API sends only two events: a public-link application and a demo request.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Hybent', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  )
})

// Tapping a notification brings an open Hybent window to that page, or opens one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        return open.focus().then((w) => (w && 'navigate' in w ? w.navigate(url) : undefined))
      }
      return self.clients.openWindow(url)
    })
  )
})
