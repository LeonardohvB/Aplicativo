// @ts-nocheck
// Edge Function (Deno) — envia Web Push para assinaturas salvas no Supabase

import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====== Env (configure com supabase secrets set) ======
const SUPABASE_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || "";

// ====== CORS ======
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// ====== VAPID ======
webpush.setVapidDetails(
  "mailto:admin@example.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ====== Supabase (service role) ======
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ====== Tipos ======
type SendInput = {
  user_id?: string;         // envia para um usuário
  tenant_id?: string;       // ou envia para todo um tenant
  title?: string;
  body?: string;
  url?: string;             // ao clicar, abre essa URL
  data?: Record<string, unknown>;
  tag?: string;
  icon?: string;
  badge?: string;
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

// ====== Utils ======
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchSubscriptions(filter: { user_id?: string; tenant_id?: string }) {
  let query = supabase.from("push_subscriptions").select("*");
  if (filter.user_id) query = query.eq("user_id", filter.user_id);
  if (filter.tenant_id) query = query.eq("tenant_id", filter.tenant_id);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function sendToSubscription(sub: any, payload: any) {
  const subscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  try {
    await webpush.sendNotification(subscription as any, JSON.stringify(payload));
    return { ok: true };
  } catch (err: any) {
    // 404/410 => assinatura inválida: apagar
    const gone = err?.statusCode === 404 || err?.statusCode === 410;
    if (gone) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return { ok: false, deleted: true, reason: err?.statusCode };
    }
    return { ok: false, reason: err?.message || "send error" };
  }
}

// ====== Handler ======
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth simples via header x-admin-token
  const hdrToken = req.headers.get("x-admin-token") || "";
  if (!ADMIN_TOKEN || hdrToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  try {
    if (req.method === "GET") {
      // atalho de teste via GET /?user_id=...&msg=...
      const url = new URL(req.url);
      const user_id = url.searchParams.get("user_id") || undefined;
      const tenant_id = url.searchParams.get("tenant_id") || undefined;
      const msg = url.searchParams.get("msg") || "Olá! 🚀";
      const openUrl = url.searchParams.get("url") || "/";

      if (!user_id && !tenant_id) {
        return jsonResponse({ error: "user_id ou tenant_id é obrigatório" }, 400);
      }

      const subs = await fetchSubscriptions({ user_id, tenant_id });
      const payload = {
        title: "Teste de notificação",
        body: msg,
        url: openUrl,
        tag: "consultorio",
      };
      const results = [];
      for (const s of subs) results.push(await sendToSubscription(s, payload));
      return jsonResponse({ count: subs.length, results });
    }

    if (req.method === "POST") {
      const input: SendInput = await req.json();
      if (!input.user_id && !input.tenant_id) {
        return jsonResponse({ error: "user_id ou tenant_id é obrigatório" }, 400);
      }

      const subs = await fetchSubscriptions({
        user_id: input.user_id,
        tenant_id: input.tenant_id,
      });

      const payload = {
        title: input.title || "Notificação",
        body: input.body || "",
        url: input.url || "/",
        tag: input.tag || "consultorio",
        icon: input.icon || "/icons/icon-192.png",
        badge: input.badge || "/icons/icon-192.png",
        actions: input.actions || [],
        data: input.data || {},
      };

      const results = [];
      for (const s of subs) results.push(await sendToSubscription(s, payload));
      return jsonResponse({ count: subs.length, results });
    }

    return jsonResponse({ error: "method not allowed" }, 405);
  } catch (e: any) {
    return jsonResponse({ error: e?.message || "internal error" }, 500);
  }
});
