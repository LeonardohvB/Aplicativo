// @ts-nocheck
// deno-lint-ignore-file
// Edge Function: push-subscribe (versão com is_active)
//
// POST   -> salva/atualiza a inscrição de push do usuário logado e marca is_active = true
// DELETE -> NÃO APAGA: só marca is_active = false (por endpoint)
//
// Autentica o usuário pelo access_token do Supabase (Authorization: Bearer ...)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL       = Deno.env.get("PROJECT_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "text/plain",
      },
    });
  }

  function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
      },
    });
  }

  try {
    // 1) autenticar usuário pelo token que veio do front
    const supaUser = createClient(PROJECT_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: req.headers.get("authorization") ?? "",
        },
      },
    });

    const {
      data: { user },
      error: userErr,
    } = await supaUser.auth.getUser();

    if (userErr || !user) {
      return json(401, { error: "unauthorized_user" });
    }

    // 2) body
    const body = await req.json().catch(() => ({}));
    const { endpoint, p256dh, auth, tenant_id } = body ?? {};

    // 3) POST = criar/reativar
    if (req.method === "POST") {
      if (!endpoint || !p256dh || !auth) {
        return json(400, { error: "missing_subscription_fields" });
      }

      const svc = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // 👇 AQUI vai o upsert com is_active = true
      const { error: upErr } = await svc
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            tenant_id: tenant_id ?? null,
            endpoint,
            p256dh,
            auth,
            user_agent: req.headers.get("user-agent") ?? null,
            is_active: true,   // <- reativa
            enabled: true,     // <- já que tua tabela tem esse campo
          },
          {
            onConflict: "user_id,endpoint",
          },
        );

      if (upErr) {
        return json(400, { error: upErr.message });
      }

      return json(200, { ok: true });
    }

    // 4) DELETE = só desativar, NÃO apagar
    if (req.method === "DELETE") {
      if (!endpoint) {
        return json(400, { error: "missing_endpoint" });
      }

      const svc = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      // 👇 ao invés de .delete(), fazemos update
      const { error: updErr } = await svc
        .from("push_subscriptions")
        .update({
          is_active: false,
          enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      if (updErr) {
        return json(400, { error: updErr.message });
      }

      return json(200, { ok: true, disabled: true });
    }

    return json(405, { error: "method_not_allowed" });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
});
