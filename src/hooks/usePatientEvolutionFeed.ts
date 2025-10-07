// src/hooks/usePatientEvolutionFeed.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/** Modelo exibido no card */
export type EvolutionItem = {
  id: string;
  encounter_id?: string | null;
  appointment_id?: string | null;
  patient_id: string;

  professional_id?: string | null;
  professional_name?: string | null;

  /** Profissão/ocupação do profissional que atendeu */
  professional_role?: string | null;

  /** Specialty registrado no evento (não usamos para o chip) */
  specialty?: string | null;

  occurred_at: string;
  title: string;
  type?: string | null;

  vitals?: {
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    height?: string;
  } | null;

  symptoms: string[];
  diagnosis: string[];
  conduct?: string | null;
  observations?: string | null;
  next_steps?: string | null;
  medications: Array<{ name: string; freq?: string; duration?: string }>;
};

type RawRow = {
  note_id?: string;
  id?: string;
  appointment_id?: string | null;
  patient_id: string;
  professional_id?: string | null;
  professional_name?: string | null;
  occurred_at?: string | null;
  ts?: string | null;
  data_json?: any;
  s_text?: string | null;
  o_text?: string | null;
  a_text?: string | null;
  p_text?: string | null;
  vitals?: any;
  meds?: any;
  tags?: string[] | null;
  specialty?: string | null;
  title?: string | null;
  type?: string | null;
};

function splitDiagnosis(a?: string | null): string[] {
  return (a || "")
    .split(/\r?\n| - |•|,|;/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** select em lote silencioso (evita erros de tipagem/404/RLS) */
async function safeSelectMap(
  table: string,
  ids: string[],
  idCol: string,
  cols?: string[]
): Promise<Record<string, Record<string, any>>> {
  const map: Record<string, Record<string, any>> = {};
  if (!ids.length) return map;
  try {
    const sel = cols && cols.length ? cols.join(",") : "*";
    const { data } = await supabase.from(table).select(sel).in(idCol, ids);
    const rows = (data ?? []) as any[];
    for (const row of rows) {
      const k = String((row as any)[idCol]);
      if (k) map[k] = row as Record<string, any>;
    }
  } catch {
    // silencioso
  }
  return map;
}

export function usePatientEvolutionFeed(patientId?: string) {
  const [data, setData] = useState<EvolutionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Feed base
        const { data: rows, error: e1 } = await supabase
          .from("patient_evolution_feed")
          .select("*")
          .eq("patient_id", patientId)
          .order("ts", { ascending: false });

        if (e1) throw e1;

        const raw = (rows as RawRow[]) ?? [];

        // 2) IDs p/ lookups
        const proIds = Array.from(
          new Set(raw.map((r) => r.professional_id).filter((x): x is string => !!x))
        );
        const apptIds = Array.from(
          new Set(raw.map((r) => r.appointment_id).filter((x): x is string => !!x))
        );

        // 3) Buscar apenas onde sabemos que existe a especialidade
        const professionalsMap = await safeSelectMap("professionals", proIds, "id", [
          "id",
          "specialty",
        ]);
        const appointmentsMap = await safeSelectMap("appointments", apptIds, "id", [
          "id",
          "specialty",
        ]);

        // 4) Normalizar + compor professional_role
        const mapped: EvolutionItem[] = raw.map((r) => {
          const id =
            r.note_id ||
            r.id ||
            (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

          const occurred_at = (r.ts || r.occurred_at || new Date().toISOString()) as string;

          const dj = r.data_json || {};
          const title = dj.title || r.title || "Consulta de Acompanhamento";

          // specialty do próprio evento (guardamos, mas não usamos no chip)
          const eventSpecialty = dj.specialty || r.specialty || null;

          const vitals = r.vitals || dj.vitals || null;

          const symptoms: string[] = Array.isArray(r.tags)
            ? (r.tags as string[])
            : Array.isArray(dj.tags)
            ? (dj.tags as string[])
            : [];

          const diagnosis: string[] =
            Array.isArray(dj.diagnosis) && dj.diagnosis.length
              ? dj.diagnosis
              : splitDiagnosis(r.a_text ?? dj.A);

          const conduct = (r.p_text ?? dj.P ?? null) || null;

          const obsO = (r.o_text ?? dj.O ?? "").toString().trim();
          const obsS = (r.s_text ?? dj.S ?? "").toString().trim();
          const observations =
            [obsO && `Objetivo: ${obsO}`, obsS && `Subjetivo: ${obsS}`]
              .filter(Boolean)
              .join("\n") || null;

          const medicationsRaw = dj.medications ?? r.meds ?? [];
          const medications = Array.isArray(medicationsRaw)
            ? (medicationsRaw as Array<{ name: string; freq?: string; duration?: string }>)
            : [];

          // prioridade: appointments.specialty → professionals.specialty
          const apptSpec =
            r.appointment_id ? appointmentsMap[r.appointment_id]?.specialty : undefined;
          const profSpec =
            r.professional_id ? professionalsMap[r.professional_id]?.specialty : undefined;

          const professional_role =
            (apptSpec && String(apptSpec).trim()) ||
            (profSpec && String(profSpec).trim()) ||
            null; // não usar o specialty do evento para evitar "Consulta (online)"

          return {
            id,
            encounter_id: null,
            appointment_id: r.appointment_id ?? null,
            patient_id: r.patient_id,
            professional_id: r.professional_id ?? null,
            professional_name: r.professional_name ?? null,

            professional_role,
            specialty: eventSpecialty,

            occurred_at,
            title,
            type: dj.type || r.type || "consultation",
            vitals,
            symptoms,
            diagnosis,
            conduct,
            observations,
            next_steps: dj.next_steps ?? null,
            medications,
          };
        });

        if (!cancelled) setData(mapped);
      } catch (err: any) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return { data, loading, error };
}
