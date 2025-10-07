// src/pages/LiveEncounter.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Stethoscope,
  ChevronLeft,
  Save,
  FileText,
  Activity,
  Thermometer,
  Scale,
  Ruler,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useEncounterDraft } from "../hooks/useEncounterDraft";

/* ===================== Tipos leves p/ UI ===================== */
type DraftUI = {
  vitals: {
    bp?: string;
    hr?: string;
    temp?: string;
    weight?: string;
    height?: string;
  };
  S: string;
  O: string;
  A: string;
  P: string;
  tags: string[];
  updatedAt?: string;
};

// props recebidas do App.tsx quando abrimos em overlay
type LiveEncounterProps = {
  initialData?: {
    appointmentId?: string;
    patientName?: string;
    professionalName?: string;
    serviceName?: string;
    encounterId?: string; // opcional: permite injetar pelo pai
  };
};

/* ===================== helpers locais ===================== */
function getEncounterIdFromURL(): string | undefined {
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("encounterId") || undefined;
  } catch {
    return undefined;
  }
}
function toStr(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
function anyVital(v: DraftUI["vitals"]): boolean {
  return !!(v.bp || v.hr || v.temp || v.weight || v.height);
}

/* Conversores do draft p/ campos da evolução */
function parseDiagnosisLines(a: string): string[] {
  return (a || "")
    .split(/\r?\n| - |•|,|;/g)
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseConduct(p: string): string | undefined {
  const t = (p || "").trim();
  return t || undefined;
}
function parseObservations(o: string, s: string): string | undefined {
  const out = [
    o?.trim() ? `Objetivo: ${o.trim()}` : "",
    s?.trim() ? `Subjetivo: ${s.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return out || undefined;
}

/** Heurística: acha o patient_id pelo nome e/ou telefone (se quisermos passar) */
async function findPatientId(patientName?: string, phoneMasked?: string) {
  let patient_id: string | undefined;

  if (patientName) {
    const { data } = await supabase
      .from("patients")
      .select("id, name")
      .ilike("name", `%${patientName}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id) patient_id = data.id;
  }

  if (!patient_id && phoneMasked) {
    const digits = (phoneMasked || "").replace(/\D+/g, "");
    if (digits.length >= 8) {
      const { data } = await supabase
        .from("patients")
        .select("id, phone")
        .ilike("phone", `%${digits}%`)
        .limit(1)
        .maybeSingle();
      if (data?.id) patient_id = data.id;
    }
  }

  return patient_id;
}

/* ========================================================== */

export default function LiveEncounter({ initialData }: LiveEncounterProps) {
  // dados do encontro/agenda que você já usava
  const [appointmentId, setAppointmentId] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("Paciente");
  const [professionalName, setProfessionalName] = useState<string>("Profissional");
  const [serviceName, setServiceName] = useState<string>("Consulta");

  // encounterId é lido de forma segura (sem precisar de Router)
  const [encounterId, setEncounterId] = useState<string | undefined>(() =>
    initialData?.encounterId || getEncounterIdFromURL()
  );

  // autosave (Supabase + cache local) do hook
  const { draft: hookDraft, setDraft: setHookDraft, saveState, clearLocal } =
    useEncounterDraft(encounterId, { appointmentId });

  // converte o draft do hook para o formato que sua UI usa
  const draft: DraftUI = useMemo(() => {
    const d: any = hookDraft || {};
    return {
      vitals: {
        bp: toStr(d?.vitals?.bp),
        hr: toStr(d?.vitals?.hr),
        temp: toStr(d?.vitals?.temp),
        weight: toStr(d?.vitals?.weight),
        height: toStr(d?.vitals?.height),
      },
      S: toStr(d?.S),
      O: toStr(d?.O),
      A: toStr(d?.A),
      P: toStr(d?.P),
      tags: Array.isArray(d?.tags) ? d.tags : [],
      updatedAt: d?.updatedAt,
    };
  }, [hookDraft]);

  // wrapper para atualizar via hook mantendo sua API de setDraft
  const setDraft = (updater: (d: DraftUI) => DraftUI) => {
    setHookDraft((prev: any) => {
      const before: DraftUI = {
        vitals: {
          bp: toStr(prev?.vitals?.bp),
          hr: toStr(prev?.vitals?.hr),
          temp: toStr(prev?.vitals?.temp),
          weight: toStr(prev?.vitals?.weight),
          height: toStr(prev?.vitals?.height),
        },
        S: toStr(prev?.S),
        O: toStr(prev?.O),
        A: toStr(prev?.A),
        P: toStr(prev?.P),
        tags: Array.isArray(prev?.tags) ? prev.tags : [],
        updatedAt: prev?.updatedAt,
      };
      const next = updater(before);
      return {
        ...prev,
        ...next,
        vitals: { ...(prev?.vitals || {}), ...(next?.vitals || {}) },
        updatedAt: new Date().toISOString(),
      };
    });
  };

  /* -------- 1) Carregar dados recebidos do App.tsx -------- */
  useEffect(() => {
    if (!initialData) return;
    setAppointmentId(String(initialData.appointmentId ?? ""));
    setPatientName(initialData.patientName ?? "Paciente");
    setProfessionalName(initialData.professionalName ?? "Profissional");
    setServiceName(initialData.serviceName ?? "Consulta");
    if (initialData.encounterId) setEncounterId(initialData.encounterId);
  }, [initialData]);

  /* -------- 2) Fallback: também aceita evento global -------- */
  useEffect(() => {
    const open = (e: any) => {
      const d = e?.detail || {};
      setAppointmentId(String(d.appointmentId || ""));
      setPatientName(d.patientName || "Paciente");
      setProfessionalName(d.professionalName || "Profissional");
      setServiceName(d.serviceName || "Consulta");
      if (d.encounterId) setEncounterId(String(d.encounterId));
    };
    window.addEventListener("encounter:open", open as EventListener);
    return () => window.removeEventListener("encounter:open", open as EventListener);
  }, []);

  /* -------- 3) Finalizar + Evolução (congela nota e fecha encontro/agenda) -------- */
  const finalize = async () => {
    try {
      // 0) garante usuário
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      // 1) Garantir encounterId (fallback usando o appointmentId)
      let eid = encounterId;
      if (!eid && appointmentId) {
        const { data, error } = await supabase.rpc("ensure_encounter", {
          p_appointment_id: appointmentId,
          p_meta: { patientName, professionalName, serviceName },
        });
        if (error) throw error;
        eid = (data as string) || undefined;
        if (eid) setEncounterId(eid);
      }

      if (!eid) {
        alert("Não foi possível identificar o encontro.");
        return;
      }

      // 2) Texto simples p/ histórico legado (opcional)
      const plain =
        [
          draft.S && `S: ${draft.S}`,
          draft.O && `O: ${draft.O}`,
          draft.A && `A: ${draft.A}`,
          draft.P && `P: ${draft.P}`,
          anyVital(draft.vitals) &&
            `VITAIS: BP=${draft.vitals.bp || "-"} | FC=${draft.vitals.hr || "-"} | Temp=${draft.vitals.temp || "-"} | Peso=${draft.vitals.weight || "-"} | Alt=${draft.vitals.height || "-"}`,
          draft.tags.length ? `Tags: ${draft.tags.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n") || null;

      // 3) Congela rascunho em encounter_notes e encerra o encontro (RPC)
      const { error: finErr } = await supabase.rpc("finalize_encounter", {
        p_encounter_id: eid,
        p_options: { data_json: draft }, // pega exatamente o que está na tela
      });
      if (finErr) throw finErr;

      // 4) Concluir SLOT na agenda — apenas por id (seu schema não tem appointment_id)
      if (appointmentId) {
        try {
          await supabase
            .from("appointment_slots")
            .update({ status: "concluido" })
            .eq("id", appointmentId);
        } catch (e) {
          console.warn("update appointment_slots skipped:", e);
        }
      }

      // 5) Criar item na EVOLUÇÃO DO PACIENTE (sem depender de appointments/history)
      try {
        // tenta achar o patient_id por nome (pode adicionar telefone se tiver)
        const patient_id = await findPatientId(patientName /*, opcionalTelefone*/);

        const occurred_at = new Date().toISOString();
        const title = serviceName || "Consulta";
        const specialty = serviceName || null;

        const vitals = {
          bp: draft.vitals.bp || undefined,
          hr: draft.vitals.hr || undefined,
          temp: draft.vitals.temp || undefined,
          weight: draft.vitals.weight || undefined,
          height: draft.vitals.height || undefined,
        };

       const evoInsert = {
  owner_id: auth.user.id,                 // (trigger também preenche)
  patient_id,                              // precisa existir
  appointment_id: appointmentId || null,
  professional_id: auth.user.id,
  professional_name: professionalName || "Profissional",
  specialty,
  title,
  type: "consultation",
  occurred_at,

  // já existia
  vitals,
  symptoms: draft.tags || [],
  diagnosis: parseDiagnosisLines(draft.A),
  conduct: parseConduct(draft.P) ?? null,
  observations: parseObservations(draft.O, draft.S) ?? null,
  next_steps: undefined,
  medications: [] as any[],

  // 👇 NOVO — o feed/timeline consome daqui:
  data_json: {
    vitals,
    S: draft.S || "",
    O: draft.O || "",
    A: draft.A || "",
    P: draft.P || "",
    tags: draft.tags || [],
    updatedAt: draft.updatedAt || new Date().toISOString(),
  },
  s_text: draft.S || null,
  o_text: draft.O || null,
  a_text: draft.A || null,
  p_text: draft.P || null,
  tags: draft.tags || [],
};


        console.log("[evolution] will-insert", evoInsert);

        if (evoInsert.patient_id) {
          const { error: evoErr } = await supabase
            .from("patient_evolution")
            .insert([evoInsert]);
          if (evoErr) console.warn("evolution insert failed:", evoErr);
        } else {
          console.warn("patient_evolution skipped: patient_id não encontrado por nome/telefone");
        }
      } catch (err) {
        console.warn("evolution creation warning:", err);
      }

      // avisa a Agenda para refletir "concluido" sem recarregar
      if (appointmentId) {
        window.dispatchEvent(
          new CustomEvent("agenda:slot:update", {
            detail: { appointmentId, status: "concluido" },
          })
        );
      }

      // 6) Limpa cache local do rascunho
      try {
        (clearLocal as any)?.();
      } catch {}

      alert("Evolução gerada e atendimento finalizado.");

      // avisa à Agenda para recarregar o card
      window.dispatchEvent(new CustomEvent("agenda:refresh"));

      // fecha o overlay
      window.dispatchEvent(new CustomEvent("encounter:close"));
    } catch (e) {
      console.warn("finalize error:", e);
      alert("Não foi possível finalizar agora. Tente novamente.");
    }
  };

  /* ===================== UI helpers ===================== */
  const setVital = (key: keyof DraftUI["vitals"], value: string) =>
    setDraft((d) => ({
      ...d,
      vitals: { ...(d.vitals || {}), [key]: value },
    }));

  const addTag = (tag: string) =>
    setDraft((d) => ({
      ...d,
      tags: Array.from(new Set([...(d.tags || []), tag])),
    }));

  const removeTag = (tag: string) =>
    setDraft((d) => ({
      ...d,
      tags: (d.tags || []).filter((t) => t !== tag),
    }));

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Topo */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("encounter:close"))}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white text-slate-700 hover:bg-slate-50 shadow"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <div className="flex items-center gap-2 text-slate-700">
              <Stethoscope className="w-5 h-5" />
              <span className="font-semibold">Atendimento ao Vivo</span>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {saveState === "saving" && "Salvando..."}
            {saveState === "saved" && "✓ Salvo"}
            {saveState === "error" && "⚠️ Falha ao salvar (offline?)"}
          </div>
        </div>

        {/* Info / Ações rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow">
            <div className="text-xs uppercase text-slate-500 mb-1">Paciente</div>
            <div className="text-slate-800 font-semibold">
              {patientName || "Paciente"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Serviço: {serviceName || "Consulta"}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <div className="text-xs uppercase text-slate-500 mb-1">Profissional</div>
            <div className="text-slate-800 font-semibold">
              {professionalName || "Profissional"}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {/* Salvar manual (opcional; agora é automático) */}
              <button
                onClick={() => alert("O rascunho já salva automaticamente 😉")}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-100 text-slate-800 hover:bg-slate-200"
              >
                <Save className="w-4 h-4" /> Salvar rascunho
              </button>

              {/* Finalizar + Evolução */}
              <button
                onClick={() => {
                  if (confirm("Gerar evolução agora e finalizar atendimento?")) {
                    finalize();
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700"
                title="Gerar evolução agora"
              >
                <FileText className="w-4 h-4" />
                Finalizar + Evolução
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow">
            <div className="text-xs uppercase text-slate-500 mb-2">Ações</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
                  alert("Rascunho copiado para a área de transferência.");
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-100 text-slate-800 hover:bg-slate-200"
              >
                <Save className="w-4 h-4" />
                Copiar rascunho
              </button>
              <button
                onClick={() => {
                  if (confirm("Limpar rascunho atual?")) {
                    setDraft(() => ({
                      vitals: {},
                      S: "",
                      O: "",
                      A: "",
                      P: "",
                      tags: [],
                    }));
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100"
              >
                Limpar rascunho
              </button>
            </div>
          </div>
        </div>

        {/* VITAIS */}
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-slate-500" />
            <div className="font-semibold text-slate-700">VITAIS</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <VitalInput
              icon={<Activity className="w-4 h-4" />}
              label="Pressão"
              placeholder="120/80"
              value={draft.vitals.bp || ""}
              onChange={(v) => setVital("bp", v)}
              chips={["120/80", "130/85", "110/70"]}
              onQuick={(v) => setVital("bp", v)}
            />
            <VitalInput
              icon={<Activity className="w-4 h-4" />}
              label="FC"
              placeholder="72 bpm"
              value={draft.vitals.hr || ""}
              onChange={(v) => setVital("hr", v)}
              chips={["68 bpm", "72 bpm", "78 bpm"]}
              onQuick={(v) => setVital("hr", v)}
            />
            <VitalInput
              icon={<Thermometer className="w-4 h-4" />}
              label="Temp."
              placeholder="36.5°C"
              value={draft.vitals.temp || ""}
              onChange={(v) => setVital("temp", v)}
              chips={["36.3°C", "36.5°C", "37.0°C"]}
              onQuick={(v) => setVital("temp", v)}
            />
            <VitalInput
              icon={<Scale className="w-4 h-4" />}
              label="Peso"
              placeholder="78.5 kg"
              value={draft.vitals.weight || ""}
              onChange={(v) => setVital("weight", v)}
              chips={["70 kg", "78.5 kg", "80 kg"]}
              onQuick={(v) => setVital("weight", v)}
            />
            <VitalInput
              icon={<Ruler className="w-4 h-4" />}
              label="Altura"
              placeholder="175 cm"
              value={draft.vitals.height || ""}
              onChange={(v) => setVital("height", v)}
              chips={["170 cm", "175 cm", "180 cm"]}
              onQuick={(v) => setVital("height", v)}
            />
          </div>
        </div>

        {/* Editor SOAP */}
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextBlock
              title="S — Subjetivo (relato do paciente)"
              value={draft.S}
              onChange={(v) => setDraft((d) => ({ ...d, S: v }))}
            />
            <TextBlock
              title="O — Objetivo (exame/achados)"
              value={draft.O}
              onChange={(v) => setDraft((d) => ({ ...d, O: v }))}
            />
            <TextBlock
              title="A — Avaliação (diagnóstico/CID)"
              value={draft.A}
              onChange={(v) => setDraft((d) => ({ ...d, A: v }))}
            />
            <TextBlock
              title="P — Plano (conduta/medicação/próximos passos)"
              value={draft.P}
              onChange={(v) => setDraft((d) => ({ ...d, P: v }))}
            />
          </div>

          {/* TAGS/Sintomas simples */}
          <div className="mt-4">
            <div className="text-xs uppercase text-slate-500 mb-2">Sintomas/Tags</div>
            <div className="flex flex-wrap gap-2">
              {draft.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    className="text-amber-700 hover:text-amber-900"
                    title="Remover"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <QuickTagInput
              onAdd={(tag) => addTag(tag)}
              suggestions={["Ansiedade leve", "Insônia", "Cefaleia", "Check-up"]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Subcomponentes ===================== */

function VitalInput({
  icon,
  label,
  placeholder,
  value,
  onChange,
  chips,
  onQuick,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  chips: string[];
  onQuick: (v: string) => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-2 text-slate-700 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <input
        className="w-full rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none px-3 py-2"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 mt-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => onQuick(c)}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function TextBlock({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-700 mb-2">{title}</div>
      <textarea
        className="w-full min-h-[140px] rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite aqui..."
      />
    </div>
  );
}

function QuickTagInput({
  onAdd,
  suggestions,
}: {
  onAdd: (t: string) => void;
  suggestions: string[];
}) {
  const [val, setVal] = useState("");

  const add = (t: string) => {
    if (!t.trim()) return;
    onAdd(t.trim());
    setVal("");
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-2">
      <input
        className="w-full md:flex-1 rounded-lg border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none px-3 py-2"
        placeholder="Adicionar tag (ex.: 'Ansiedade leve')"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add(val);
        }}
      />

      <div className="flex flex-wrap gap-2 w-full md:w-auto">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => add(s)}
            className="text-xs px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
