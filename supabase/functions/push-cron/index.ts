// @ts-nocheck
// deno-lint-ignore-file

import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ===== CORS ===== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ===== ENVs ===== */
const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || "";

/* ===== Helpers ===== */
function isGone(e: string) {
  const m = String(e || "");
  return (
    m.includes("410") ||
    m.includes("404") ||
    m.toLowerCase().includes("gone")
  );
}

/**
 * Autorização da chamada:
 * 1. header x-admin-token === ADMIN_TOKEN
 * 2. Authorization: Bearer SERVICE_ROLE_KEY
 * 3. user-agent começa com pg_net/ (cron interno chamando via pg_net)
 */
function isAuthorized(req: Request) {
  const admin = req.headers.get("x-admin-token");
  if (admin && ADMIN_TOKEN && admin === ADMIN_TOKEN) return true;

  const auth =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    if (token === SERVICE_ROLE_KEY) return true;
  }

  const ua =
    req.headers.get("user-agent") ||
    req.headers.get("User-Agent") ||
    "";
  if (ua.startsWith("pg_net/")) {
    return true;
  }

  return false;
}

/**
 * Formata um horário UTC (string ou Date) para "HH:MM" no fuso local fixo
 * (America/Sao_Paulo) sem AM/PM.
 */
function formatLocalHHMM(isoStringOrDate: string | Date) {
  const dt = new Date(isoStringOrDate);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(dt);
}

/**
 * Busca compromissos na view v_appointment_starts dentro de um intervalo [startIso, endIso)
 * Espera colunas: slot_id, journey_id, owner_id, starts_at_utc
 */
async function fetchAppointmentsInWindow(
  supabase,
  startIso: string,
  endIso: string
) {
  const { data, error } = await supabase
    .from("v_appointment_starts")
    .select("slot_id, journey_id, owner_id, starts_at_utc")
    .gte("starts_at_utc", startIso)
    .lt("starts_at_utc", endIso);

  if (error) {
    throw new Error("select_due: " + error.message);
  }
  return data || [];
}

/**
 * Envia notificações para uma lista de compromissos e registra log de envio
 * respeitando idempotência via push_notifications_log(unique).
 *
 * kind: "before_30m" | "before_10m" | "late"
 * buildPayloadFn(row, hhmmLocal) -> { title, body, tag, url?, data? }
 */
async function notifyBatch(supabase, rows, kind, buildPayloadFn) {
  // Donos (profissionais) a serem notificados
  const targets = Array.from(
    new Set(
      rows
        .map((r: any) => r.owner_id)
        .filter(Boolean)
    )
  );

  if (!targets.length) {
    return {
      kind,
      appointments: rows.length,
      targets: 0,
      sent: 0,
      details: [],
    };
  }

  // Pega subscriptions destes donos
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", targets);

  if (subsErr) {
    throw new Error("select_subs: " + subsErr.message);
  }

  // Agrupa subscriptions por user
  const byUser = new Map<string, any[]>();
  (subs || []).forEach((s: any) => {
    const arr = byUser.get(s.user_id) || [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  });

  let sent = 0;
  const details: any[] = [];

  for (const row of rows) {
    // ID canônico do atendimento (sempre usar o mesmo em log/tag)
    const apptId = row.slot_id ?? row.journey_id;
    const userId = row.owner_id;
    if (!apptId || !userId) continue;

    // Tenta gravar no log primeiro, pra garantir idempotência.
    // Se já existir (unique), não vamos reenviar.
    const { error: dupErr } = await supabase
      .from("push_notifications_log")
      .insert({
        appointment_id: apptId,
        target_user_id: userId,
        kind,
      });

    if (dupErr) {
      const msg = String(dupErr.message || "").toLowerCase();
      if (!msg.includes("duplicate")) {
        // erro inesperado -> não envia push, só loga
        details.push({
          apptId,
          step: "log_insert",
          kind,
          error: dupErr.message,
        });
        continue;
      } else {
        // duplicate -> a gente já mandou essa notificação pra esse user/appt/kind
        details.push({
          apptId,
          warn: "duplicate skip",
          kind,
        });
        continue;
      }
    }

    // Se chegou aqui, é "primeiro envio" desse tipo pra esse atendimento
    const userSubs = byUser.get(userId) || [];
    if (!userSubs.length) {
      details.push({
        apptId,
        warn: "no subscriptions for owner",
        userId,
        kind,
      });
      continue;
    }

    const localHHMM = formatLocalHHMM(row.starts_at_utc);

    // Gera conteúdo específico do alerta
    const payloadData = buildPayloadFn(row, localHHMM); // { title, body, tag, url?. data? }

    const finalPayload = JSON.stringify({
      title: payloadData.title,
      body: payloadData.body,
      url: payloadData.url ?? "/agenda",
      tag: payloadData.tag,
      data: {
        url: payloadData.url ?? "/agenda",
        appointment_id: apptId,
        kind,
        ...(payloadData.data || {}),
      },
    });

    // Envia pra todas as subscriptions do profissional
    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          finalPayload,
          { TTL: 900 } // 15 min
        );
        sent++;
      } catch (e) {
        const msg = String(e?.message || e);
        details.push({
          apptId,
          endpoint: s.endpoint,
          kind,
          error: msg,
        });
        if (isGone(msg)) {
          // subscription inválida/expirada -> apaga
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", s.endpoint)
            .eq("user_id", s.user_id);
        }
      }
    }
  }

  return {
    kind,
    appointments: rows.length,
    targets: targets.length,
    sent,
    details,
  };
}

/* ===== SERVE ===== */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!isAuthorized(req)) {
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        }
      );
    }

    // valida se as chaves VAPID estão presentes
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_vapid" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "content-type": "application/json",
          },
        }
      );
    }

    webpush.setVapidDetails(
      "mailto:push@yourapp.example",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-application-name": "push-cron" } },
    });

    // Base de tempo: "floor" = agora truncado pro minuto (zera segundos)
    const now = new Date();
    const floor = new Date(Math.floor(now.getTime() / 60000) * 60000);

    /**
     * 1) 30 minutos antes:
     *    Dispara para consultas que começam na faixa [agora+28, agora+32] min
     */
    const start30 = new Date(floor.getTime() + 28 * 60 * 1000);
    const end30   = new Date(floor.getTime() + 32 * 60 * 1000);

    const due30 = await fetchAppointmentsInWindow(
      supabase,
      start30.toISOString(),
      end30.toISOString()
    );

    /**
     * 2) 10 minutos antes:
     *    Dispara para consultas que começam na faixa [agora+8, agora+12] min
     */
    const start10 = new Date(floor.getTime() + 8 * 60 * 1000);
    const end10   = new Date(floor.getTime() + 12 * 60 * 1000);

    const due10 = await fetchAppointmentsInWindow(
      supabase,
      start10.toISOString(),
      end10.toISOString()
    );

    /**
     * 3) Atrasado:
     *    Dispara apenas se a consulta começou faz pelo menos 5 minutos
     *    e no máximo 15 minutos.
     *
     *    Janela = [agora-15min, agora-5min]
     *    -> evita alerta antes de começar
     *    -> evita flood eterno
     *    -> manda "tá atrasado" ~5+ minutos depois
     */
    const startLate = new Date(floor.getTime() - 15 * 60 * 1000); // 15 min atrás
    const endLate   = new Date(floor.getTime() - 5  * 60 * 1000); // 5 min atrás

    const late = await fetchAppointmentsInWindow(
      supabase,
      startLate.toISOString(),
      endLate.toISOString()
    );

    // Agora mandamos cada categoria com texto próprio:

    const res30 = await notifyBatch(
      supabase,
      due30,
      "before_30m",
      (row, hhmmLocal) => ({
        title: "Lembrete: atendimento em 30 minutos",
        body: `Consulta marcada às ${hhmmLocal}.`,
        url: "/agenda",
        tag: `appt-${(row.slot_id ?? row.journey_id)}-before30m`,
      })
    );

    const res10 = await notifyBatch(
      supabase,
      due10,
      "before_10m",
      (row, hhmmLocal) => ({
        title: "Lembrete: atendimento em 10 minutos",
        body: `Consulta marcada às ${hhmmLocal}.`,
        url: "/agenda",
        tag: `appt-${(row.slot_id ?? row.journey_id)}-before10m`,
      })
    );

    const resLate = await notifyBatch(
      supabase,
      late,
      "late",
      (row, hhmmLocal) => ({
        title: "Atendimento atrasado",
        body: `Você tinha um horário às ${hhmmLocal} e ainda não começou.`,
        url: "/agenda",
        tag: `appt-${(row.slot_id ?? row.journey_id)}-late`,
      })
    );

    // resposta de debug / monitoramento
    return new Response(
      JSON.stringify({
        ok: true,
        now: now.toISOString(),
        windows: {
          before30m: {
            start: start30.toISOString(),
            end: end30.toISOString(),
          },
          before10m: {
            start: start10.toISOString(),
            end: end10.toISOString(),
          },
          late: {
            start: startLate.toISOString(),
            end: endLate.toISOString(),
          },
        },
        stats: {
          before30m: res30,
          before10m: res10,
          late: resLate,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        fatal: String(err?.message || err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "content-type": "application/json",
        },
      }
    );
  }
});
