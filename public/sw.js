/* public/sw.js - versão segura para produção (Vercel) */
/* não usar TypeScript aqui */

self.addEventListener("install", (event) => {
  // força instalar e já pegar o controle
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* ============ PUSH ============ */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() || "Nova notificação" };
  }

  const title = payload.title || "Nova notificação";
  const options = {
    body: payload.body || payload.message || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-72.png",
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ============ CLICK ============ */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.find((c) => c.url === url);
      if (hadWindow && "focus" in hadWindow) {
        return hadWindow.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
