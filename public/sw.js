// public/sw.js

// Abrir ou focar uma aba existente do app
async function openOrFocus(url) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  const normalized = new URL(url, self.location.origin).href;

  for (const client of allClients) {
    try {
      const href = new URL(client.url).href;
      if (href === normalized && "focus" in client) {
        return client.focus();
      }
    } catch (e) {
      // ignora abas com URL inválida (ex: about:blank)
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(normalized);
  }
}

// Instala e assume controle imediatamente
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Mensagem opcional pra forçar update (hot swap de SW)
self.addEventListener("message", (event) => {
  const data = event && event.data;
  if (data && typeof data === "object" && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Recebe push vindo da Edge Function
self.addEventListener("push", (event) => {
  try {
    const raw = event?.data?.text?.();
    console.log("[SW] push recebido; raw:", raw);
  } catch {
    console.log("[SW] push recebido; sem data ou erro ao ler");
  }

  // Normalizar payload
  let payload = {};
  try {
    if (event.data) {
      payload = JSON.parse(event.data.text());
    }
  } catch (e) {
    // fallback se não vier JSON válido
    payload = {
      title: "Notificação",
      body: event.data?.text() ?? "",
    };
  }

  const dataObj = { ...(payload.data || {}) };

  const title =
    payload.title ||
    dataObj.title ||
    "Notificação";

  const body =
    payload.body ||
    dataObj.body ||
    "";

  const icon =
    payload.icon ||
    dataObj.icon ||
    "/icons/android-chrome-192x192.png";

  let badge =
    payload.badge ||
    dataObj.badge ||
    "/icons/badge-72x72.png";

  const tag =
    payload.tag ||
    dataObj.tag ||
    `push-${Date.now()}`;

  const clickUrl =
    payload.url ||
    dataObj.url ||
    "/";

  const options = {
    body,
    icon,
    tag,
    data: {
      url: clickUrl,
      ...dataObj,
    },
    requireInteraction: Boolean(
      payload.requireInteraction ??
      dataObj.requireInteraction ??
      false
    ),
    renotify: Boolean(
      payload.renotify ??
      dataObj.renotify ??
      false
    ),
  };

  if (typeof badge === "string" && badge.trim()) {
    options.badge = badge;
  }

  if (Array.isArray(payload.actions)) {
    options.actions = payload.actions;
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification erro:", err);
    })
  );
});

// Clique na notificação → focar aba ou abrir app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification?.data && event.notification.data.url) || "/";
  event.waitUntil(openOrFocus(url));
});
