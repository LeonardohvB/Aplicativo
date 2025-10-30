/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// @ts-ignore
self.__WB_MANIFEST;

/* instalar */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

/* ativar */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* fetch padrão */
self.addEventListener("fetch", (_event) => {
  // deixa com o navegador / workbox
});

/* 👉 AQUI É O QUE FALTAVA 👇 */
self.addEventListener("push", (event) => {
  // o Supabase/web-push normalmente manda um JSON no event.data
  const data = event.data ? event.data.json() : {};

  const title = data.title || "Nova notificação";
  const options: NotificationOptions = {
    body: data.body || "Você tem uma nova atualização.",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    data: {
      url: data.url || "/", // pra abrir depois no click
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* clique na notificação → focar ou abrir */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const c = client as WindowClient;
        if (c.url === url && "focus" in c) {
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
