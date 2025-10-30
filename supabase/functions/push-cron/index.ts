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
 * Campos usados:
 *   slot_id, journey_id, owner_id, patient_id, starts_at_utc
 */
async function fetchAppointmentsInWindow(
  supabase,
  startIso: string,
  endIso: string
) {
  const { data, error } = await supabase
    .from("v_appointment_starts")
    .select(
      "slot_id, journey_id, owner_id, patient_id, starts_at_utc"
    )
    .eq("status", "agendado") // 🔹 filtra apenas consultas agendadas
    .gte("starts_at_utc", startIso)
    .lt("starts_at_utc", endIso);

  if (error) {
    throw new Error("select_due: " + error.message);
  }
  return data || [];
}

/**
 * Monta um mapa patient_id -> nome do paciente
 * usando a tabela public.patients.
 */
async function buildPatientNameMap(supabase, rows) {
  const ids = Array.from(
    new Set(
      rows
        .map((r: any) => r.patient_id)
        .filter(Boolean)
    )
  );

  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("patients")
    .select("id, name")
    .in("id", ids);

  if (error) {
    throw new Error("select_patients: " + error.message);
  }

  const map = new Map();
  for (const p of data || []) {
    const display =
      (p.name && String(p.name).trim()) ||
      "Paciente agendado";
    map.set(p.id, display);
  }
  return map;
}

/**
 * Envia notificações para uma lista de compromissos e registra log de envio
 * respeitando idempotência via push_notifications_log(unique).
 */
async function notifyBatch(supabase, rows, kind, buildPayloadFn) {
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

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", targets);

  if (subsErr) {
    throw new Error("select_subs: " + subsErr.message);
  }

  const byUser = new Map<string, any[]>();
  (subs || []).forEach((s: any) => {
    const arr = byUser.get(s.user_id) || [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  });

  const patientNameMap = await buildPatientNameMap(supabase, rows);

  let sent = 0;
  const details: any[] = [];

  for (const row of rows) {
    const apptId = row.slot_id ?? row.journey_id;
    const userId = row.owner_id;
    if (!apptId || !userId) continue;

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
        details.push({
          apptId,
          step: "log_insert",
          kind,
          error: dupErr.message,
        });
        continue;
      } else {
        details.push({
          apptId,
          warn: "duplicate skip",
          kind,
        });
        continue;
      }
    }

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
    const patientDisplay =
      patientNameMap.get(row.patient_id) || "Paciente agendado";

    const payloadData = buildPayloadFn(row, localHHMM, patientDisplay);

    // 🔴 AQUI é onde a gente diferencia Apple x resto
    for (const s of userSubs) {
      const isApple =
        typeof s.endpoint === "string" &&
        s.endpoint.startsWith("https://web.push.apple.com");

      // desktop / chrome / android → payload completo (o seu de antes)
      const richPayload = JSON.stringify({
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

      // iPhone → payload enxuto (igual ao teste manual)
      const applePayload = JSON.stringify({
        title: payloadData.title,
        body: payloadData.body,
        data: {
          url: payloadData.url ?? "/agenda",
        },
      });

      const payloadToSend = isApple ? applePayload : richPayload;

      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payloadToSend,
          { TTL: 900 }
        );
        sent++;
        details.push({
          apptId,
          kind,
          endpoint: isApple ? "apple" : "other",
          sent: true,
        });
      } catch (e) {
        const msg = String(e?.message || e);
        details.push({
          apptId,
          endpoint: s.endpoint,
          kind,
          apple: isApple,
          error: msg,
        });
        if (isGone(msg)) {
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

    const now = new Date();
    const floor = new Date(Math.floor(now.getTime() / 60000) * 60000);

    // 30 minutos
    const start30 = new Date(floor.getTime() + 28 * 60 * 1000);
    const end30 = new Date(floor.getTime() + 32 * 60 * 1000);
    const due30 = await fetchAppointmentsInWindow(
      supabase,
      start30.toISOString(),
      end30.toISOString()
    );

    // 10 minutos
    const start10 = new Date(floor.getTime() + 8 * 60 * 1000);
    const end10 = new Date(floor.getTime() + 12 * 60 * 1000);
    const due10 = await fetchAppointmentsInWindow(
      supabase,
      start10.toISOString(),
      end10.toISOString()
    );

    // atrasado
    const startLate = new Date(floor.getTime() - 15 * 60 * 1000);
    const endLate = new Date(floor.getTime() - 5 * 60 * 1000);
    const late = await fetchAppointmentsInWindow(
      supabase,
      startLate.toISOString(),
      endLate.toISOString()
    );

    const res30 = await notifyBatch(
      supabase,
      due30,
      "before_30m",
      (row, hhmmLocal, patientDisplay) => ({
        title: "Lembrete: atendimento em 30 minutos",
        body:
          `Paciente: ${patientDisplay}\n` +
          `Consulta marcada às ${hhmmLocal}.`,
        url: "/agenda",
        tag: `appt-${row.slot_id ?? row.journey_id}-before30m`,
      })
    );

    const res10 = await notifyBatch(
      supabase,
      due10,
      "before_10m",
      (row, hhmmLocal, patientDisplay) => ({
        title: "Lembrete: atendimento em 10 minutos",
        body:
          `Paciente: ${patientDisplay}\n` +
          `Consulta marcada às ${hhmmLocal}.`,
        url: "/agenda",
        tag: `appt-${row.slot_id ?? row.journey_id}-before10m`,
      })
    );

    const resLate = await notifyBatch(
      supabase,
      late,
      "late",
      (row, hhmmLocal, patientDisplay) => ({
        title: "Atendimento atrasado",
        body:
          `Paciente: ${patientDisplay}\n` +
          `Você tinha um horário às ${hhmmLocal} e ainda não começou.`,
        url: "/agenda",
        tag: `appt-${row.slot_id ?? row.journey_id}-late`,
      })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        now: now.toISOString(),
        windows: {
          before30m: { start: start30.toISOString(), end: end30.toISOString() },
          before10m: { start: start10.toISOString(), end: end10.toISOString() },
          late: { start: startLate.toISOString(), end: endLate.toISOString() },
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
