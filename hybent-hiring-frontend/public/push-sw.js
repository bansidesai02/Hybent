/* Hybent phone notifications (Web Push) — push only.
 *
 * Registered by src/utils/push.ts under its own scope (/push-sw/), apart from
 * the app's caching worker (src/firebase-messaging-sw.ts), so it works the
 * same on the dev server and in production and can't affect page caching.
 *
 * A device gets push only after its user taps "Turn on" in Settings; nothing
 * asks for permission on its own.
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
      // A repeat of the same tag still alerts instead of replacing silently.
      renotify: Boolean(data.tag),
      vibrate: [200, 100, 200],
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
