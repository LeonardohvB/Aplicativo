// @ts-nocheck
// deno-lint-ignore-file
// Edge Function: push-subscribe
// Recebe a inscrição do navegador e salva em push_subscriptions
// Autentica com o access_token do usuário (Bearer) — profissional logado

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL       = Deno.env.get("PROJECT_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!; // precisa estar nos Secrets
const SERVICE_ROLE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // 1) Autentica o usuário pelo token do Supabase Auth (Bearer <access_token>)
    const supaUser = createClient(PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    });

    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized_user" }), {
        status: 401,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    // 2) Lê a inscrição enviada pelo frontend
    const body = await req.json().catch(() => ({}));
    const { endpoint, p256dh, auth, tenant_id } = body ?? {};
    if (!endpoint || !p256dh || !auth) {
      return new Response(JSON.stringify({ error: "missing_subscription_fields" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    // 3) Usa service role só para gravar (upsert) com segurança
    const svc = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: upErr } = await svc
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,          // PROFISSIONAL LOGADO
          tenant_id: tenant_id ?? null,
          endpoint,
          p256dh,
          auth,
          user_agent: req.headers.get("user-agent") ?? null,
        },
        { onConflict: "user_id,endpoint" }
      );

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
