/// <reference lib="webworker" />
/* Service Worker (produção) — public/sw.js */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* abrir/focar rota */
async function openOrFocus(url) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const full = new URL(url, self.location.origin).href;
  for (const client of clients) {
    try {
      if (new URL(client.url).href === full && "focus" in client) {
        return client.focus();
      }
    } catch (_) {}
  }
  if (self.clients.openWindow) return self.clients.openWindow(full);
}

/* push */
self.addEventListener("push", (event) => {
  // parse robusto (sem logs)
  let payload = {};
  try {
    if (event.data && typeof event.data.json === "function") {
      payload = event.data.json();
    } else if (event.data) {
      const t = event.data.text() || "{}";
      payload = JSON.parse(t);
    }
  } catch (_) {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch {}
  }

  const n = payload.notification || {};
  const d = payload.data || {};

  const title = payload.title || n.title || d.title || "Notificação";
  const body  = payload.body  || n.body  || d.body  || "";
  const icon  = payload.icon  || n.icon  || d.icon  || "/icons/icon-192.png";
  const badge = payload.badge || n.badge || d.badge || "/icons/icon-192.png";
  const tag   = payload.tag   || n.tag   || d.tag   || "consultorio";
  const url   = payload.url   || n.url   || d.url   || "/";
  const actions = payload.actions || n.actions || d.actions || [];

  const options = {
    body,
    icon,
    badge,
    tag,
    actions,
    data: { url, ...d },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* click */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(openOrFocus(url));
});
