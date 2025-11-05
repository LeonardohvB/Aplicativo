// @ts-nocheck
// deno-lint-ignore-file

import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================== CORS ================== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

/* ================== ENVs ================== */
const PROJECT_URL = Deno.env.get("PROJECT_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("ADMIN_TOKEN") || "";

/* ================= Helpers ================= */
function isGone(e: unknown) {
  const m = String(e || "");
  return (
    m.includes("410") ||
    m.includes("404") ||
    m.toLowerCase().includes("gone") ||
    m.toLowerCase().includes("not registered")
  );
}

/** auth: x-admin-token | Bearer service_role | pg_net */
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
  if (ua.startsWith("pg_net/")) return true;

  return false;
}

/** HH:MM America/Sao_Paulo */
function formatLocalHHMM(iso: string | Date) {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(dt);
}

/** busca agendamentos na janela */
async function fetchAppointmentsInWindow(
  supabase: any,
  startIso: string,
  endIso: string,
) {
  const { data, error } = await supabase
    .from("v_appointment_starts")
    .select("slot_id, journey_id, owner_id, patient_id, starts_at_utc, status")
    .eq("status", "agendado")
    .gte("starts_at_utc", startIso)
    .lt("starts_at_utc", endIso);

  if (error) throw new Error("select_due: " + error.message);
  return data || [];
}

/** mapa de nomes de pacientes */
async function buildPatientNameMap(supabase: any, rows: any[]) {
  const ids = Array.from(
    new Set(rows.map((r: any) => r.patient_id).filter(Boolean)),
  );
  if (!ids.length) return new Map();

  const { data, error } = await supabase
    .from("patients")
    .select("id, name")
    .in("id", ids);

  if (error) throw new Error("select_patients: " + error.message);

  const map = new Map();
  for (const p of data || []) {
    const display = (p.name && String(p.name).trim()) || "Paciente agendado";
    map.set(p.id, display);
  }
  return map;
}

/** Envia lote e loga resultado (sem duplicar) */
async function notifyBatch(
  supabase: any,
  rows: any[],
  kind: "before_10m" | "before_30m" | "late",
  buildPayloadFn: (row: any, hhmmLocal: string, patientName: string) => {
    title: string;
    body: string;
    url?: string;
    tag: string;
    data?: Record<string, unknown>;
  },
) {
  const targets = Array.from(
    new Set(rows.map((r: any) => r.owner_id).filter(Boolean)),
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

  // subscriptions dos donos
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .eq("is_active", true)
    .eq("enabled", true)
    .in("user_id", targets);

  if (subsErr) throw new Error("select_subs: " + subsErr.message);

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

   // ===== log de envio (permite reentrega para novos devices) =====
let isDuplicate = false;

const { error: insErr } = await supabase
  .from("push_notifications_log")
  .insert({ appointment_id: apptId, target_user_id: userId, kind });

if (insErr) {
  const m = String(insErr.message || "").toLowerCase();
  if (m.includes("duplicate") || m.includes("unique")) {
    // já existe log para (appointment_id, user_id, kind):
    // → ainda assim vamos ENVIAR (para permitir novos devices)
    isDuplicate = true;
  } else {
    details.push({ apptId, step: "log_insert", kind, error: insErr.message });
    continue;
  }
}


    const localHHMM = formatLocalHHMM(row.starts_at_utc);
    const patientDisplay =
      patientNameMap.get(row.patient_id) || "Paciente agendado";

    const payloadData = buildPayloadFn(row, localHHMM, patientDisplay);

    for (const s of byUser.get(userId) || []) {
      const isApple =
        typeof s.endpoint === "string" &&
        s.endpoint.startsWith("https://web.push.apple.com");

      // ===== payload plano (top-level) =====
      const common = {
        title: payloadData.title,
        body: payloadData.body,
        url: payloadData.url ?? "/agenda",
        tag: payloadData.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: {
          url: payloadData.url ?? "/agenda",
          appointment_id: apptId,
          kind,
          ...(payloadData.data || {}),
        },
      };

      const richPayload = JSON.stringify(common);

      // Apple (enxuto)
      const applePayload = JSON.stringify({
  title: common.title,
  body: common.body.replace(/\n/g, " "), // remove quebras
  data: { url: common.url },
});


      const payloadToSend = isApple ? applePayload : richPayload;

      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payloadToSend,
          { TTL: 900 },
        );
        sent++;
        details.push({
          apptId,
          kind,
          endpoint: isApple ? "apple" : "other",
          sent: true,
          duplicate: isDuplicate
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

/* ================== SERVE ================== */
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
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_vapid" }),
        {
          status: 500,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    webpush.setVapidDetails(
      "mailto:push@yourapp.example",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );

    const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { "x-application-name": "push-cron" } },
    });

    const now = new Date();
    const floor = new Date(Math.floor(now.getTime() / 60000) * 60000);

    // ===== Janelas (1 minuto cada) =====
// T-10: dispara exatamente 10 min antes
const start10 = new Date(floor.getTime() + 10 * 60 * 1000);
const end10   = new Date(start10.getTime() + 60 * 1000);

// T-30: dispara exatamente 30 min antes
const start30 = new Date(floor.getTime() + 30 * 60 * 1000);
const end30   = new Date(start30.getTime() + 60 * 1000);

// ATRASADO: dispara exatamente 5 min depois do horário (ajuste aqui se quiser 3/7/10)
const LATE_MINUTES = 5;
const startLate = new Date(floor.getTime() - LATE_MINUTES * 60 * 1000);
const endLate   = new Date(startLate.getTime() + 60 * 1000);

const due10 = await fetchAppointmentsInWindow(supabase, start10.toISOString(), end10.toISOString());
const due30 = await fetchAppointmentsInWindow(supabase, start30.toISOString(), end30.toISOString());
const late  = await fetchAppointmentsInWindow(supabase, startLate.toISOString(), endLate.toISOString());


   // T-10 (exatamente o texto que você pediu)
const res10 = await notifyBatch(
  supabase,
  due10,
  "before_10m",
  (row, hhmmLocal, patient) => ({
    title: "Lembrete de Consulta",
    body: `Faltam 10 minutos para a consulta de ${patient} às ${hhmmLocal}.\nToque para abrir a agenda.`,
    url: "/agenda",
    tag: `appt-${row.slot_id ?? row.journey_id}-before10m`,
  })
);

// T-30 (opcional — manteve padrão curto)
const res30 = await notifyBatch(
  supabase,
  due30,
  "before_30m",
  (row, hhmmLocal, patient) => ({
    title: "Lembrete de Consulta",
    body: `Faltam 30 minutos para a consulta de ${patient} às ${hhmmLocal}.\nToque para abrir a agenda.`,
    url: "/agenda",
    tag: `appt-${row.slot_id ?? row.journey_id}-before30m`,
  })
);

// ATRASADO (+5 min)
const resLate = await notifyBatch(
  supabase,
  late,
  "late",
  (row, hhmmLocal, patient) => ({
    title: "Consulta atrasada",
    body: `A consulta de ${patient} às ${hhmmLocal} está atrasada.\nToque para abrir a agenda.`,
    url: "/agenda",
    tag: `appt-${row.slot_id ?? row.journey_id}-late`,
  })
);


    return new Response(
      JSON.stringify({
        ok: true,
        now: now.toISOString(),
        windows: {
          before10m: { start: start10.toISOString(), end: end10.toISOString() },
          before30m: { start: start30.toISOString(), end: end30.toISOString() },
          late:      { start: startLate.toISOString(), end: endLate.toISOString() },
        },
        stats: { before10m: res10, before30m: res30, late: resLate },
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, fatal: String(err?.message || err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
