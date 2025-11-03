/// <reference lib="webworker" />
/* Service Worker (Workbox injectManifest) - src/sw.ts */
declare const self: ServiceWorkerGlobalScope;

/* ========================= utils ========================= */
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

/* ======================= lifecycle ======================= */
self.addEventListener("install", (_event: ExtendableEvent) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = (event as any)?.data;
  if (data && typeof data === "object" && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* ========================== push ========================= */
self.addEventListener("push", (event: PushEvent) => {
  // Log seguro (não quebra se não houver data)
  try {
    const raw = event?.data?.text?.();
    console.log("[SW] push recebido; raw:", raw);
  } catch {
    console.log("[SW] push recebido; sem data ou erro ao ler");
  }

  // 1) Normaliza payload
  let payload: any = {};
  try {
    if (event.data) payload = JSON.parse(event.data.text());
  } catch {
    payload = { title: "Notificação", body: event.data?.text() ?? "" };
  }

  // Aceita topo (title/body/url/icon/badge/tag) e/ou data.title/data.url etc.
  const dataObj = { ...(payload.data ?? {}) };

  const title =
    payload.title ?? dataObj.title ?? "Notificação";

  const body =
    payload.body ??
    dataObj.body ??
    "";

  const icon =
    payload.icon ??
    dataObj.icon ??
    "/icons/android-chrome-192x192.png";

  let badge =
    payload.badge ??
    dataObj.badge ??
    "/icons/badge-72x72.png";

  const tag =
    payload.tag ??
    dataObj.tag ??
    `push-${Date.now()}`;

  const clickUrl =
    payload.url ??
    dataObj.url ??
    "/";

  // 2) Monta options
 const options: NotificationOptions = {
  body,
  icon,
  tag,
  data: { url: clickUrl, ...dataObj },
};

(options as any).requireInteraction = Boolean(
  payload.requireInteraction ?? dataObj.requireInteraction ?? false
);
(options as any).renotify = Boolean(
  payload.renotify ?? dataObj.renotify ?? false
);

  // 3) Badge: remove se vazio/ inválido (Chrome ignora/buga quando inválido)
  try {
    if (typeof badge === "string" && badge.trim()) {
      (options as any).badge = badge;
    }
  } catch {
    // sem badge
  }

  // 4) Actions (opcional)
  if (Array.isArray(payload.actions)) {
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

/* ===================== notification click ===================== */
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url =
    (event.notification.data && (event.notification.data as any).url) || "/";
  event.waitUntil(openOrFocus(url));
});

/* ===== Workbox injection point (precisa existir UMA vez) ===== */
// @ts-ignore
(self as any).__WB_MANIFEST = [] as any;

