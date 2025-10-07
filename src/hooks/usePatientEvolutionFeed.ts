// src/hooks/usePatientEvolutionFeed.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Formato normalizado para exibir na timeline.
 * Mantém os campos que precisamos no card (título, especialidade, vitais, etc.).
 */
export type EvolutionItem = {
  id: string;                     // note_id | id
  encounter_id?: string | null;
  appointment_id?: string | null;
  patient_id: string;
  professional_id?: string | null;
  professional_name?: string | null;
  specialty?: string | null;

  occurred_at: string;            // ts | occurred_at (ISO)
  title: string;                  // "Consulta", "Acompanhamento", etc.
  type?: string | null;           // consultation | retorno | ...

  vitals?: {
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    height?: string;
  } | null;

  symptoms: string[];             // tags
  diagnosis: string[];            // derivado de A ou array
  conduct?: string | null;        // P (Plano/conduta)
  observations?: string | null;   // O (Objetivo) + S (Subjetivo)
  next_steps?: string | null;     // opcional
  medications: Array<{ name: string; freq?: string; duration?: string }>;
};

type RawRow = {
  note_id?: string;
  id?: string;
  appointment_id?: string | null;
  patient_id: string;
  professional_id?: string | null;
  professional_name?: string | null;
  occurred_at?: string | null; // alguns ambientes podem ter occurred_at na tabela
  ts?: string | null;          // nossa view expõe como ts
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

      // buscamos na view; ela pode ter colunas com nomes levemente diferentes entre ambientes,
      // então selecionamos * e normalizamos abaixo.
      const { data: rows, error } = await supabase
        .from("patient_evolution_feed")
        .select("*")
        .eq("patient_id", patientId)
        .order("ts", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error);
        setData([]);
        setLoading(false);
        return;
      }

      const mapped: EvolutionItem[] = (rows as RawRow[]).map((r) => {
        // id
        const id = r.note_id || r.id || crypto.randomUUID();

        // occurred_at (usa ts da view; fallback para occurred_at direto)
        const occurred_at = (r.ts || r.occurred_at || new Date().toISOString()) as string;

        // título e especialidade: preferir data_json.title/specialty
        const dj = r.data_json || {};
        const title =
          dj.title ||
          r.title ||
          "Consulta de Acompanhamento";

        const specialty = dj.specialty || r.specialty || null;

        // vitais: preferir coluna vitals; fallback data_json.vitals
        const vitals = r.vitals || dj.vitals || null;

        // sintomas/tags
        const symptoms: string[] = Array.isArray(r.tags)
          ? (r.tags as string[])
          : Array.isArray(dj.tags)
          ? (dj.tags as string[])
          : [];

        // diagnóstico: preferir array; senão quebrar texto de A
        const diagnosis: string[] =
          Array.isArray(dj.diagnosis) && dj.diagnosis.length
            ? dj.diagnosis
            : splitDiagnosis(r.a_text ?? dj.A);

        // conduta (P)
        const conduct = (r.p_text ?? dj.P ?? null) || null;

        // observações = Objetivo + Subjetivo numa string
        const obsO = (r.o_text ?? dj.O ?? "").toString().trim();
        const obsS = (r.s_text ?? dj.S ?? "").toString().trim();
        const observations =
          [obsO && `Objetivo: ${obsO}`, obsS && `Subjetivo: ${obsS}`]
            .filter(Boolean)
            .join("\n") || null;

        // medicamentos: tentar dj.medications | r.meds
        const medicationsRaw = dj.medications ?? r.meds ?? [];
        const medications = Array.isArray(medicationsRaw)
          ? (medicationsRaw as Array<{ name: string; freq?: string; duration?: string }>)
          : [];

        return {
          id,
          encounter_id: null, // sua view não tem esse campo; deixe null/omita
          appointment_id: r.appointment_id ?? null,
          patient_id: r.patient_id,
          professional_id: r.professional_id ?? null,
          professional_name: r.professional_name ?? null,
          specialty,
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

      setData(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return { data, loading, error };
}
