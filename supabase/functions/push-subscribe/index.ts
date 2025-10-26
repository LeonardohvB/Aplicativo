// @ts-nocheck
// deno-lint-ignore-file
// Edge Function: push-subscribe
//
// POST   -> salva/atualiza a inscrição de push do usuário logado
// DELETE -> remove a inscrição de push do usuário logado (por endpoint)
//
// Autentica o usuário pelo access_token do Supabase (Authorization: Bearer ...)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL       = Deno.env.get("PROJECT_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY  = Deno.env.get("SERVICE_ROLE_KEY")!;

// Monta headers CORS consistentes para todas as respostas
function corsHeaders(origin: string | null) {
  return {
    // se você quiser travar para só um domínio (ex: só vercel), troque "*" por um whitelist
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // 0. pré-flight (CORS). Browser chama OPTIONS antes de DELETE/POST.
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "text/plain",
      },
    });
  }

  // helper pra responder JSON já com CORS
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
    // 1. Autenticar usuário a partir do token Bearer vindo do frontend
    //    (o frontend envia Authorization: Bearer <session.access_token>)
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

    // 2. Ler body JSON (tanto POST quanto DELETE usam endpoint)
    const body = await req.json().catch(() => ({}));
    const { endpoint, p256dh, auth, tenant_id } = body ?? {};

    // 3. Branch por método
    // --- POST: salvar / atualizar subscription ---
    if (req.method === "POST") {
      if (!endpoint || !p256dh || !auth) {
        return json(400, { error: "missing_subscription_fields" });
      }

      // Service Role client para poder escrever na tabela
      const svc = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

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
          },
          { onConflict: "user_id,endpoint" }
        );

      if (upErr) {
        return json(400, { error: upErr.message });
      }

      return json(200, { ok: true });
    }

    // --- DELETE: remover inscrição desse usuário e endpoint específico ---
    if (req.method === "DELETE") {
      if (!endpoint) {
        return json(400, { error: "missing_endpoint" });
      }

      const svc = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      const { error: delErr } = await svc
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("endpoint", endpoint);

      if (delErr) {
        return json(400, { error: delErr.message });
      }

      return json(200, { ok: true, deleted: true });
    }

    // --- qualquer outro método ---
    return json(405, { error: "method_not_allowed" });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
});
