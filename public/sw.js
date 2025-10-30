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
  let payload = {};
  try {
    if (event.data) payload = JSON.parse(event.data.text());
  } catch (e) {
    payload = {
      title: "Notificação",
      body: event.data ? event.data.text() : "",
    };
  }

  const data = payload.data || {};
  const title = payload.title || data.title || "Notificação";
  const body = payload.body || data.body || "";
  const icon = payload.icon || data.icon || "/icons/icon-192.png";
  const url = payload.url || data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      data: { url, ...data },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(openOrFocus(url));
});
