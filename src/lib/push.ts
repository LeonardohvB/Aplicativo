// src/lib/push.ts
import { supabase } from "./supabase";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    typeof PushManager !== "undefined"
  );
}

function urlBase64ToUint8Array(base64String: string) {
  // normaliza padding e caracteres
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // com vite-plugin-pwa, o SW já é registrado; usamos o ready
  return await navigator.serviceWorker.ready;
}

async function requestPermission(): Promise<NotificationPermission> {
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

type EnableArgs = {
  userId: string;
  tenantId?: string | null;
};

export async function enableWebPush({ userId, tenantId = null }: EnableArgs) {
  if (!isPushSupported()) throw new Error("Navegador não suporta Web Push.");
  const perm = await requestPermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada.");

  const reg = await getRegistration();

  // já existe?
  const existing = await reg.pushManager.getSubscription();
  let sub = existing;
  if (!sub) {
    const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
    if (!vapid) throw new Error("VITE_VAPID_PUBLIC_KEY ausente.");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  // extrair dados
  const json = sub.toJSON() as any;
  const endpoint: string = json.endpoint;
  const p256dh: string = json.keys?.p256dh;
  const auth: string = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Assinatura inválida (sem keys).");
  }

  // salvar no Supabase (upsert por endpoint)
  const ua = navigator.userAgent;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        tenant_id: tenantId,
        endpoint,
        p256dh,
        auth,
        user_agent: ua,
      },
      { onConflict: "endpoint" }
    );

  if (error) throw error;

  return { endpoint };
}

export async function disableWebPush() {
  if (!isPushSupported()) return;

  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  // opcional: você pode também deletar no Supabase por endpoint, se quiser.
}

export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}
