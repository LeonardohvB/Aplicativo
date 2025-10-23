/// <reference lib="webworker" />
/* Service Worker (Workbox injectManifest) - src/sw.ts */
declare const self: ServiceWorkerGlobalScope;

// --- utils
async function openOrFocus(url: string) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const normalized = new URL(url, self.location.origin).href;
  for (const client of allClients) {
    const c = client as WindowClient;
    try {
      const href = new URL(c.url).href;
      if (href === normalized && "focus" in c) {
        return c.focus();
      }
    } catch {}
  }
  if (self.clients.openWindow) return self.clients.openWindow(normalized);
}

// --- lifecycle
self.addEventListener("install", (_event: ExtendableEvent) => {
  self.skipWaiting(); // ativa imediatamente
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim()); // controla abas já abertas
});

// permite postMessage({ type: 'SKIP_WAITING' })
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = (event as any)?.data;
  if (data && typeof data === "object" && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- push (força visibilidade e ignora badge potencialmente inválido)
self.addEventListener("push", (event: PushEvent) => {
  try {
    const raw = event?.data?.text?.();
    console.log("[SW] push recebido; raw:", raw);
  } catch {
    console.log("[SW] push recebido; sem data ou erro ao ler");
  }

  let payload: any = {};
  try {
    if (event.data) {
      payload = JSON.parse(event.data.text());
    }
  } catch {
    payload = { title: "Notificação", body: event.data?.text() ?? "" };
  }

  // evita problemas: badge inválido às vezes bloqueia a notificação
  if ("badge" in payload) delete (payload as any).badge;

  const title = payload.title || "Nova notificação";
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    data: { url: payload.url || "/", ...(payload.data || {}) },
    tag: (payload.tag as any) || "debug",
  };

  // força visibilidade (depois você pode ler do payload se quiser)
  (options as any).requireInteraction = true;
  (options as any).renotify = true;

  if (payload.actions) {
    (options as any).actions = payload.actions as Array<{
      action: string;
      title: string;
      icon?: string;
    }>;
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification erro:", err);
    })
  );
});

// --- click
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data && (event.notification.data as any).url) || "/";
  event.waitUntil(openOrFocus(url));
});

// ---- Workbox injection point (precisa existir UMA vez) ----
// @ts-ignore
(self as any).__WB_MANIFEST = [] as any;

export {};
