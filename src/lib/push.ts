// src/lib/push.ts
// Fluxo completo: inscrever no PushManager, salvar via Edge Function (push-subscribe),
// enviar teste opcional via /push/send (apenas se tiver ADMIN_TOKEN),
// e re-inscrever automaticamente em 404/410.

// === Endpoints ===
const SUBSCRIBE_URL = "https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push-subscribe";
const ADMIN_PUSH_BASE = "https://yhcxdcnveyxntfzwaovp.functions.supabase.co/push"; // /send (opcional/admin)

// === ENVs (frontend) ===
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY
// - VITE_VAPID_PUBLIC_KEY
// - (opcional) VITE_ADMIN_TOKEN  -> para /push/send de teste

import { supabase } from "./supabase"; // 👈 usamos o client único já criado
// (caminho relativo: se esse arquivo estiver em src/lib/push.ts e o supabase.ts
// estiver em src/lib/supabase.ts, então "./supabase" está correto)

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

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Se quiser registrar aqui: await navigator.serviceWorker.register("/sw.js");
  return await navigator.serviceWorker.ready;
}

async function ensurePermission(): Promise<NotificationPermission> {
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

type EnableArgs = { tenantId?: string | null };

/**
 * Inscreve no navegador e SALVA via Edge Function autenticada (push-subscribe).
 * O user_id é inferido pelo token do Supabase Auth (Authorization: Bearer ...).
 */
export async function enableWebPush({ tenantId = null }: EnableArgs = {}) {
  if (!isPushSupported()) throw new Error("Navegador não suporta Web Push.");
  if (!VAPID_PUBLIC_KEY) throw new Error("VITE_VAPID_PUBLIC_KEY ausente.");

  const perm = await ensurePermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada.");

  // token do usuário logado (profissional)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sem sessão do usuário (login necessário).");

  const reg = await getRegistration();

  // Reaproveita se já existir
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // 👇 garante que não é undefined / inválido
  if (!sub) {
    throw new Error("Falha ao criar a subscription do push.");
  }

  const subJson = sub.toJSON() as any;
  const p256dh = subJson?.keys?.p256dh as string | undefined;
  const auth = subJson?.keys?.auth as string | undefined;

  if (!p256dh || !auth) {
    // (opcional) faça um unsubscribe para resetar estado inconsistente
    try {
      await sub.unsubscribe();
    } catch {}
    throw new Error("Subscription inválida (sem chaves p256dh/auth). Tente novamente.");
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
    }),
  });

  if (!res.ok) {
    // rollback (desinscreve local) se falhar
    try {
      await sub.unsubscribe();
    } catch {}
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha ao salvar inscrição (${res.status}) ${txt}`);
  }

  return { endpoint: sub.endpoint };
}

/** Remove inscrição local e tenta remover no backend por endpoint (autenticado) */
export async function disableWebPush() {
  if (!isPushSupported()) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  try {
    await fetch(SUBSCRIBE_URL, {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    // ignora
  }

  await sub.unsubscribe();
}

export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/**
 * Envia uma notificação de teste via função admin /push/send (opcional).
 * Requer VITE_ADMIN_TOKEN (ou que /push/send aceite service role).
 */
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
  if (ADMIN_TOKEN) headers["x-admin-token"] = ADMIN_TOKEN; // se a função exigir admin-token

  const res = await fetch(`${ADMIN_PUSH_BASE}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ subscription: sub.toJSON(), payload }),
  });

  // subscription expirada no servidor → re-inscreve automaticamente
  if (res.status === 404 || res.status === 410) {
    try {
      await sub.unsubscribe();
    } catch {}
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    throw new Error("Subscription expirou (404/410). Reinscrita; tente novamente.");
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha no envio (${res.status}) ${txt}`);
  }
  return res.json();
}

/** Alias útil se você quiser expor explicitamente */
export async function unsubscribePush() {
  return disableWebPush();
}
