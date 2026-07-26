// Verboo Code service worker
const CACHE = 'verboo-v1'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return
  // Network-first for API requests
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })))
    return
  }
  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (res.ok && url.pathname !== '/') {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
    }).catch(() => caches.match('/'))
  )
})

// Push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'Verboo', {
      body: data.body || '',
      icon: data.icon || '/verboo-logo-icon.png',
      badge: '/verboo-logo-icon.png',
      tag: data.tag || 'verboo',
      data: data.url,
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  if (e.notification.data) {
    e.waitUntil(clients.openWindow(e.notification.data))
  }
})
