// src/sw.ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

// (fix tipagem antiga) — algumas versões não têm NotificationOptions.actions.
// Se a sua lib já tiver, essa declaração é simplesmente ignorada.
declare global {
  interface NotificationOptions {
    actions?: Array<{ action: string; title: string; icon?: string }>
  }
}

// ===== lifecycle
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ===== utils
async function openOrFocus(url: string) {
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const found = all.find((c: any) => (c.url || '') === url || (c.url || '').includes(url))
  if (found && 'focus' in found) return (found as WindowClient).focus()
  return self.clients.openWindow(url)
}

// ===== push
self.addEventListener('push', (event: PushEvent) => {
  let payload: any = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Notificação', body: event.data?.text() || '' }
  }

  const title = payload.title || 'Notificação'
  const body = payload.body || ''
  const icon = payload.icon || '/icons/icon-192.png'
  const badge = payload.badge || '/icons/icon-192.png'
  const tag = payload.tag || 'consultorio'
  const url = payload.url || '/'
  const actions = (payload.actions || []) as NotificationOptions['actions']

  const options: NotificationOptions = {
    body,
    icon,
    badge,
    tag,
    data: { url, ...payload.data },
    actions,                // agora tipado
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ===== click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data && (event.notification.data as any).url) || '/'
  event.waitUntil(openOrFocus(url))
})
