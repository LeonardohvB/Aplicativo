/// <reference lib="webworker" />
/* Service Worker raiz (public/sw.js) */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ============== util: abrir ou focar uma aba/rota ============== */
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

/* ========================== push ========================== */
self.addEventListener("push", (event) => {
  // 0) Log do bruto (útil para depurar)
  try {
    const rawText = event?.data?.text?.();
    console.log("[SW] raw event.data.text():", rawText);
  } catch (e) {
    console.log("[SW] raw read error:", e);
  }

  // 1) Parse robusto: tenta .json(), cai para .text() -> JSON.parse
  let payload = {};
  try {
    if (event.data && typeof event.data.json === "function") {
      payload = event.data.json();
      console.log("[SW] payload via .json():", payload);
    } else if (event.data) {
      const t = event.data.text() || "{}";
      console.log("[SW] text before JSON.parse:", t);
      payload = JSON.parse(t);
      console.log("[SW] payload via JSON.parse:", payload);
    }
  } catch (e) {
    console.warn("[SW] parse error, fallback:", e);
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch {}
  }

  // 2) Normaliza campos (aceita topo, data.*, notification.*)
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

  // Logs finais do que será exibido
  console.log("[SW] normalized fields:", { title, body, icon, badge, tag, url, actions });
  console.log("[SW] notification options:", options);

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification error:", err);
    })
  );
});

/* =================== notification click =================== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(openOrFocus(url));
});
