/// <reference lib="webworker" />
/* eslint-disable no-underscore-dangle */
import {precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL} from 'workbox-precaching'
import {registerRoute, NavigationRoute} from 'workbox-routing'
import {StaleWhileRevalidate, NetworkFirst, CacheFirst} from 'workbox-strategies'
import {ExpirationPlugin} from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// __WB_MANIFEST is injected at build time by workbox
precacheAndRoute(self.__WB_MANIFEST || [])
cleanupOutdatedCaches()

// App Shell-style navigation fallback to index.html
const navHandler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(navHandler, {
  allowlist: [/^\/(?!api).*/],
})
registerRoute(navigationRoute)

// Static assets from same-origin: CSS/JS/Images -> CacheFirst with expiration
registerRoute(
  ({request, sameOrigin}) =>
    sameOrigin && ['style','script','image','font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-assets-v1',
    plugins: [
      new ExpirationPlugin({maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30}), // 30 days
    ]
  })
)

// API calls (e.g., Supabase) -> NetworkFirst
registerRoute(
  ({url}) => url.origin.includes('supabase.co') || url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7}), // 7 days
    ]
  })
)

// Basic push notifications (Web Push)
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json?.() ?? {}
  const title = data.title || 'Nova notificação'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: data.data || {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data && (event.notification.data as any).url) || '/'
  event.waitUntil(
    self.clients.matchAll({type: 'window'}).then(windowClients => {
      for (const client of windowClients) {
        if ('focus' in client) return (client as WindowClient).focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
