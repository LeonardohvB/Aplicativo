/// <reference lib="webworker" />
/* Service Worker (Workbox injectManifest) - src/sw.ts */
declare const self: ServiceWorkerGlobalScope;

// Workbox injeta esta constante em build (em dev pode não existir)
declare const __WB_MANIFEST: any;

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
  // ativa imediatamente a nova versão
  self.skipWaiting();
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  // passa a controlar todas as abas já abertas
  event.waitUntil(self.clients.claim());
});

// permite postMessage({ type: 'SKIP_WAITING' })
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = (event as any)?.data;
  if (data && typeof data === "object" && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- push (forçar visibilidade e ignorar badge inválido)
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
      const txt = event.data.text();
      payload = JSON.parse(txt);
    }
  } catch {
    payload = { title: "Notificação", body: event.data?.text() ?? "" };
  }

  // ⚠️ evita problemas com badge inválido
  if ("badge" in payload) {
    delete payload.badge;
  }

  const title = payload.title || "Nova notificação";

  // só chaves conhecidas no literal
  const options: NotificationOptions = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    data: { url: payload.url || "/", ...(payload.data || {}) },
    tag: (payload.tag as any) || "debug",
  };

  // garante que fique visível e toque som/renotify (via cast)
  (options as any).requireInteraction = true;
  (options as any).renotify = true;

  // se vierem actions, adiciona via cast
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
  const url =
    (event.notification.data && (event.notification.data as any).url) || "/";
  event.waitUntil(openOrFocus(url));
});

// --- “toca” o símbolo do Workbox apenas em produção (no dev ele pode não existir)
if ((import.meta as any).env?.PROD) {
  (self as any).__WB_MANIFEST;
}

// garante escopo de módulo para o TS
export {};
