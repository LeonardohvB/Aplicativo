/// <reference lib="webworker" />
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

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
    } catch (e) {}
  }
  if (self.clients.openWindow) return self.clients.openWindow(full);
}

self.addEventListener("push", (event) => {
  // Parse robusto: tenta .json(), cai para .text(), aceita payload plano ou aninhado
  let payload = {};
  try {
    if (event.data && typeof event.data.json === "function") {
      payload = event.data.json();
    } else if (event.data) {
      payload = JSON.parse(event.data.text() || "{}");
    }
  } catch (_e) {
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

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      actions,
      data: { url, ...d },
      requireInteraction: false
    })
  );
});


self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(openOrFocus(url));
});
