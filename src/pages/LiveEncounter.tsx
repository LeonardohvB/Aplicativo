// src/pages/LiveEncounter.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Stethoscope,
  ChevronLeft,
  FileText,
  Activity,
  Thermometer,
  Scale,
  Ruler,
  Heart,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useEncounterDraft } from "../hooks/useEncounterDraft";

/* ==========================================================
   Toasts (inline)
   ========================================================== */
type ToastKind = "success" | "error" | "info";
type ToastItem = { id: string; kind: ToastKind; title?: string; message?: string };

function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = (t: Omit<ToastItem, "id">, ttl = 3000) => {
    const id = Math.random().toString(36).slice(2);
    const item = { id, ...t };
    setItems((arr) => [...arr, item]);
    if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  };
  const dismiss = (id: string) => setItems((arr) => arr.filter((i) => i.id !== id));
  return {
    items,
    dismiss,
    success: (message: string, title = "Tudo certo") =>
      push({ kind: "success", message, title }),
    error: (message: string, title = "Algo deu errado") =>
      push({ kind: "error", message, title }),
    info: (message: string, title = "Atenção") => push({ kind: "info", message, title }),
  };
}

const Toasts: React.FC<{
  items: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ items, onDismiss }) => (
  <div className="fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
    {items.map((t) => {
      const Icon =
        t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
      const bg =
        t.kind === "success"
          ? "bg-emerald-600"
          : t.kind === "error"
          ? "bg-rose-600"
          : "bg-slate-700";
      return (
        <div
          key={t.id}
          className={`pointer-events-auto w-full max-w-[520px] rounded-xl ${bg} text-white shadow-lg ring-1 ring-black/10 px-4 py-3 animate-toast-in`}
        >
          <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="flex-1">
              {t.title && <div className="font-semibold">{t.title}</div>}
              {t.message && <div className="text-sm opacity-90">{t.message}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      );
    })}

    <style>{`
      @keyframes toast-in { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      .animate-toast-in { animation: toast-in .18s ease-out both; }
    `}</style>
  </div>
);

/* ==========================================================
   Modal de confirmação (inline, central, com zoom)
   ========================================================== */
const ConfirmDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
}> = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  icon,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-[420px] rounded-2xl bg-white shadow-xl ring-1 ring-black/10 p-4 sm:p-5 animate-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 text-blue-600">{icon}</div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            )}
            <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
              <button
                className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                onClick={onClose}
                autoFocus
              >
                {cancelText}
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes zoom-in { 0% { transform: scale(.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-zoom-in { animation: zoom-in 200ms cubic-bezier(.2,.8,.2,1) both; }
        .animate-fade-in { animation: fade-in 160ms ease-out both; }
      `}</style>
    </div>
  );
};

/* ==========================================================
   Tipos leves p/ UI
   ========================================================== */
type DraftUI = {
  vitals: { bp?: string; hr?: string; temp?: string; weight?: string; height?: string };
  S: string;
  O: string;
  A: string;
  P: string;
  tags: string[];
  updatedAt?: string;
};

type LiveEncounterProps = {
  initialData?: {
    appointmentId?: string;
    patientName?: string;
    professionalName?: string;
    serviceName?: string;
    encounterId?: string;
  };
};

/* ===================== helpers ===================== */
function getEncounterIdFromURL(): string | undefined {
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("encounterId") || undefined;
  } catch {
    return undefined;
  }
}
function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}
function anyVital(v: DraftUI["vitals"]): boolean {
  return !!(v.bp || v.hr || v.temp || v.weight || v.height);
}
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

/** Heurística: acha o patient_id pelo nome e/ou telefone */
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

/* ==========================================================
   Subcomponentes simples
   ========================================================== */
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
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-gray-800 mb-2">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <input
        className="w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent px-3 py-2"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => onQuick(c)}
            className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
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
      <div className="text-sm font-bold text-gray-800 mb-2">{title}</div>
      <textarea
        className="w-full min-h-[140px] rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent px-3 py-2 resize-none"
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
    const clean = (t || "").trim();
    if (!clean) return;
    onAdd(clean);
    setVal("");
  };

  return (
    <div className="flex flex-col md:flex-row md:items-start gap-2">
      <input
        className="w-full md:flex-1 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent px-3 py-2"
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
            className="text-xs px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 whitespace-nowrap"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   Componente Principal
   ========================================================== */
export default function LiveEncounter({ initialData }: LiveEncounterProps) {
  // toasts
  const toasts = useToasts();

  // dados gerais
  const [appointmentId, setAppointmentId] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("Paciente");
  const [professionalName, setProfessionalName] = useState<string>("Profissional");
  const [serviceName, setServiceName] = useState<string>("Consulta");
  const [showVitals, setShowVitals] = useState<boolean>(true);

  // encounter id
  const [encounterId, setEncounterId] = useState<string | undefined>(() =>
    initialData?.encounterId || getEncounterIdFromURL()
  );

  // modal confirmar finalizar
  const [confirmOpen, setConfirmOpen] = useState(false);

  // pedido de auto-finalização (quando vem da Agenda)
  const [autoFinalizeRequested, setAutoFinalizeRequested] = useState(false);

  // autosave (Supabase + cache local)
  const { draft: hookDraft, setDraft: setHookDraft, saveState, clearLocal } =
    useEncounterDraft(encounterId, { appointmentId });

  // adapta o draft do hook p/ UI
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

  // setter compatível
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

  /* -------- Carregar dados recebidos do pai -------- */
  useEffect(() => {
    if (!initialData) return;
    setAppointmentId(String(initialData.appointmentId ?? ""));
    setPatientName(initialData.patientName ?? "Paciente");
    setProfessionalName(initialData.professionalName ?? "Profissional");
    setServiceName(initialData.serviceName ?? "Consulta");
    if (initialData.encounterId) setEncounterId(initialData.encounterId);
  }, [initialData]);

  /* -------- Listener global encounter:open -------- */
  useEffect(() => {
    const open = (e: Event) => {
      const anyE = e as CustomEvent<any>;
      const d = anyE?.detail || {};
      setAppointmentId(String(d.appointmentId || ""));
      setPatientName(d.patientName || "Paciente");
      setProfessionalName(d.professionalName || "Profissional");
      setServiceName(d.serviceName || "Consulta");
      if (d.encounterId) setEncounterId(String(d.encounterId));
      if (d.autoFinalize) setAutoFinalizeRequested(true);
    };
    window.addEventListener("encounter:open", open as EventListener);
    return () => window.removeEventListener("encounter:open", open as EventListener);
  }, []);

  /* -------- Se veio autoFinalize da Agenda, finaliza sem pedir novo confirm -------- */
  useEffect(() => {
    if (!autoFinalizeRequested) return;
    const t = setTimeout(() => {
      finalize(); // usa o mesmo finalize() que cria evolução
      setAutoFinalizeRequested(false);
    }, 250);
    return () => clearTimeout(t);
  }, [autoFinalizeRequested]);

  /* ===================== Finalizar + Evolução ===================== */
  const finalize = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        toasts.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // 1) Garante encounterId
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
        toasts.error("Não foi possível identificar o encontro.");
        return;
      }

      // 2) plain text (opcional)
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

      // 3) finalize_encounter
      const { error: finErr } = await supabase.rpc("finalize_encounter", {
        p_encounter_id: eid,
        p_options: { data_json: draft, plain_text: plain },
      });
      if (finErr) throw finErr;

      // 4) Atualiza status do slot
      if (appointmentId) {
        try {
          await supabase.from("appointment_slots").update({ status: "concluido" }).eq("id", appointmentId);
        } catch (e) {
          console.warn("update appointment_slots skipped:", e);
        }
      }

      // 5) Cria evolução do paciente
      try {
        const patient_id = await findPatientId(patientName);
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

        const userId = (await supabase.auth.getUser()).data.user?.id as string;

        const evoInsert = {
          owner_id: userId,
          patient_id,
          appointment_id: appointmentId || null,
          professional_id: userId,
          professional_name: professionalName || "Profissional",
          specialty,
          title,
          type: "consultation",
          occurred_at,
          vitals,
          symptoms: draft.tags || [],
          diagnosis: parseDiagnosisLines(draft.A),
          conduct: parseConduct(draft.P) ?? null,
          observations: parseObservations(draft.O, draft.S) ?? null,
          next_steps: undefined,
          medications: [] as any[],
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

        if (evoInsert.patient_id) {
          const { error: evoErr } = await supabase.from("patient_evolution").insert([evoInsert]);
          if (evoErr) console.warn("evolution insert failed:", evoErr);
        } else {
          console.warn("patient_evolution skipped: patient_id não encontrado");
        }
      } catch (err) {
        console.warn("evolution creation warning:", err);
      }

      // 6) sinaliza agenda e limpa cache local
      if (appointmentId) {
        window.dispatchEvent(
          new CustomEvent("agenda:slot:update", {
            detail: { appointmentId, status: "concluido" },
          })
        );
      }
      try {
        (clearLocal as any)?.();
      } catch {}

      toasts.success("Evolução gerada e atendimento finalizado.");
      window.dispatchEvent(new CustomEvent("agenda:refresh"));
      window.dispatchEvent(new CustomEvent("encounter:close"));
    } catch (e) {
      console.warn("finalize error:", e);
      toasts.error("Não foi possível finalizar agora. Tente novamente.");
    }
  };

  /* ===================== UI helpers ===================== */
  const setVital = (key: keyof DraftUI["vitals"], value: string) =>
    setDraft((d) => ({ ...d, vitals: { ...(d.vitals || {}), [key]: value } }));

  const addTag = (tag: string) =>
    setDraft((d) => ({ ...d, tags: Array.from(new Set([...(d.tags || []), tag])) }));

  const removeTag = (tag: string) =>
    setDraft((d) => ({ ...d, tags: (d.tags || []).filter((t) => t !== tag) }));

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Voltar (padrão) */}
            <button
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              onClick={() => window.dispatchEvent(new CustomEvent("encounter:close"))}
            >
              <ChevronLeft size={20} />
              <span className="font-medium">Voltar</span>
            </button>

            <div className="flex items-center gap-2 text-gray-600">
              <Clock size={18} />
              <span className="text-sm">Atendimento ao Vivo</span>
              <Stethoscope className="w-4 h-4 opacity-80" />
            </div>

            <div className="text-sm text-gray-500">
              {saveState === "saving" && "Salvando..."}
              {saveState === "saved" && "✓ Salvo"}
              {saveState === "error" && "⚠️ Falha ao salvar (offline?)"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Paciente */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">PACIENTE</p>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{patientName || "Paciente"}</h2>
          <p className="text-sm text-gray-600">Serviço: {serviceName || "Consulta"}</p>
        </div>

        {/* Profissional */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">PROFISSIONAL</p>
          <h3 className="text-lg font-bold text-gray-900">{professionalName || "Profissional"}</h3>
          <p className="text-sm text-gray-600">{serviceName || ""}</p>

          <div className="mt-4">
            <div className="flex">
              <button
                onClick={() => setConfirmOpen(true)}
                title="Gerar evolução agora"
                className="
                  inline-flex items-center justify-center gap-2
                  rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                  px-3 py-2 text-xs leading-tight sm:text-sm
                  whitespace-normal text-center min-h-[40px]
                "
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="text-[14px] leading-tight">Finalizar Evolução</span>
              </button>
            </div>
          </div>
        </div>

        {/* VITAIS */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="text-blue-600" size={20} />
              <h3 className="text-lg font-bold text-gray-900">SINAIS VITAIS</h3>
            </div>

            {/* Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {showVitals ? "Ocultar" : "Mostrar"} sinais vitais
              </span>
              <button
                onClick={() => setShowVitals((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showVitals ? "bg-blue-600" : "bg-gray-300"
                }`}
                aria-label="Alternar sinais vitais"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showVitals ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {showVitals ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <VitalInput
                icon={<Activity className="w-4 h-4 text-blue-600" />}
                label="Pressão"
                placeholder="120/80"
                value={draft.vitals.bp || ""}
                onChange={(v) => setVital("bp", v)}
                chips={["120/80", "130/85", "110/70"]}
                onQuick={(v) => setVital("bp", v)}
              />
              <VitalInput
                icon={<Heart className="w-4 h-4 text-blue-600" />}
                label="FC"
                placeholder="72 bpm"
                value={draft.vitals.hr || ""}
                onChange={(v) => setVital("hr", v)}
                chips={["68 bpm", "72 bpm", "78 bpm"]}
                onQuick={(v) => setVital("hr", v)}
              />
              <VitalInput
                icon={<Thermometer className="w-4 h-4 text-blue-600" />}
                label="Temp."
                placeholder="36.5 °C"
                value={draft.vitals.temp || ""}
                onChange={(v) => setVital("temp", v)}
                chips={["36.3 °C", "36.5 °C", "37.0 °C"]}
                onQuick={(v) => setVital("temp", v)}
              />
              <VitalInput
                icon={<Scale className="w-4 h-4 text-blue-600" />}
                label="Peso"
                placeholder="78.5 kg"
                value={draft.vitals.weight || ""}
                onChange={(v) => setVital("weight", v)}
                chips={["70 kg", "78.5 kg", "80 kg"]}
                onQuick={(v) => setVital("weight", v)}
              />
              <VitalInput
                icon={<Ruler className="w-4 h-4 text-blue-600" />}
                label="Altura"
                placeholder="175 cm"
                value={draft.vitals.height || ""}
                onChange={(v) => setVital("height", v)}
                chips={["170 cm", "175 cm", "180 cm"]}
                onQuick={(v) => setVital("height", v)}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 text-sm">
                Os sinais vitais estão ocultos para este tipo de atendimento.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Ative o switch acima se precisar registrar sinais vitais.
              </p>
            </div>
          )}
        </div>

        {/* Editor SOAP */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
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

          {/* TAGS/Sintomas */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">SINTOMAS/TAGS</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {(draft.tags || []).map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    className="hover:text-blue-900"
                    aria-label={`Remover ${t}`}
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

      {/* Modal Confirmar Finalização */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          finalize();
        }}
        title="Finalizar atendimento?"
        description="Gerar evolução agora e marcar este atendimento como concluído."
        confirmText="Finalizar"
        cancelText="Cancelar"
        icon={<FileText className="w-6 h-6" />}
      />

      {/* Toasts */}
      <Toasts items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
