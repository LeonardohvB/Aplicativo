// src/lib/push.ts

const SUBSCRIBE_URL =
  "https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push-subscribe";
const ADMIN_PUSH_BASE =
  "https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push";

import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN as string | undefined;

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined"
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// 👇 AQUI É O PULO DO GATO
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // se já existe SW controlando a página, só espera
  if (navigator.serviceWorker.controller) {
    return await navigator.serviceWorker.ready;
  }

  // se NÃO existe, registra o nosso SW simples que está em public/sw.js
  await navigator.serviceWorker.register("/sw.js");
  return await navigator.serviceWorker.ready;
}

async function ensurePermission(): Promise<NotificationPermission> {
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

type EnableArgs = { tenantId?: string | null };

export async function enableWebPush({ tenantId = null }: EnableArgs = {}) {
  if (!isPushSupported()) throw new Error("Navegador não suporta Web Push.");
  if (!VAPID_PUBLIC_KEY) throw new Error("VITE_VAPID_PUBLIC_KEY ausente.");

  const perm = await ensurePermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada.");

  // precisa estar logado
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sem sessão do usuário (login necessário).");

  // garante que tem SW
  const reg = await getRegistration();

  // reaproveita inscrição
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  if (!sub) throw new Error("Falha ao criar a subscription do push.");

  const subJson = sub.toJSON() as any;
  const p256dh = subJson?.keys?.p256dh as string | undefined;
  const auth = subJson?.keys?.auth as string | undefined;

  if (!p256dh || !auth) {
    try {
      await sub.unsubscribe();
    } catch {}
    throw new Error(
      "Subscription inválida (sem chaves p256dh/auth). Tente novamente."
    );
  }

  const res = await fetch(SUBSCRIBE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh,
      auth,
      tenant_id: tenantId ?? null,
      user_agent: navigator.userAgent,
    }),
  });

  if (!res.ok) {
    try {
      await sub.unsubscribe();
    } catch {}
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha ao salvar inscrição (${res.status}) ${txt}`);
  }

  return { endpoint: sub.endpoint };
}

export async function disableWebPush() {
  if (!isPushSupported()) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  const endpoint = sub?.endpoint ?? null;

  // desativa no Supabase
  if (endpoint) {
    await fetch(SUBSCRIBE_URL, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint }),
    });
  }
}
 
export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

export async function sendTest(payload: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  badge?: string;
}) {
  if (!isPushSupported()) throw new Error("Web Push não suportado.");
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) throw new Error("Não há subscription ativa");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ADMIN_TOKEN) headers["x-admin-token"] = ADMIN_TOKEN;

  const res = await fetch(`${ADMIN_PUSH_BASE}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ subscription: sub.toJSON(), payload }),
  });

  if (res.status === 404 || res.status === 410) {
    try {
      await sub.unsubscribe();
    } catch {}
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    throw new Error(
      "Subscription expirou (404/410). Reinscrita; tente novamente."
    );
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha no envio (${res.status}) ${txt}`);
  }
  return res.json();
}

export async function unsubscribePush() {
  return disableWebPush();
}
