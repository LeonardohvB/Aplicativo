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
  Pill as PillIcon,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useEncounterDraft } from "../hooks/useEncounterDraft";

/* ==========================================================
   Toasts (inline)
   ========================================================== */
type ToastKind = "success" | "error" | "info";
type ToastItem = { id: string; kind: ToastKind; title?: string; message?: string };

type ToastHelpers = {
  items: ToastItem[];
  dismiss: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

function useToasts(): ToastHelpers {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = (id: string) => {
    setItems((arr) => arr.filter((i) => i.id !== id));
  };

  const push = (t: Omit<ToastItem, "id">, ttl = 4000) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, ...t };
    setItems((arr) => [...arr, item]);
    if (ttl > 0) setTimeout(() => dismiss(id), ttl);
  };

  return {
    items,
    dismiss,
    success: (message: string, title = "Tudo certo") =>
      push({ kind: "success", message, title }),
    error: (message: string, title = "Algo deu errado") =>
      push({ kind: "error", message, title }),
    info: (message: string, title = "Atenção") =>
      push({ kind: "info", message, title }),
  };
}


// ➜ container agora em CIMA e centralizado
const Toasts: React.FC<{
  items: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ items, onDismiss }) => (
  <div className="fixed inset-x-0 top-4 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
    {items.map((t) => {
      const Icon =
        t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
      const bg =
        t.kind === "success"
          ? "bg-emerald-600"
          : t.kind === "error"
          ? "bg-rose-600"
          : "bg-red-600";
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
      @keyframes toast-in { 0% { transform: translateY(-8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      .animate-toast-in { animation: toast-in .18s ease-out both; }
    `}</style>
  </div>
);

/* ==========================================================
   Modal de Finalização (com 2 ações + sair)
   ========================================================== */
const FinalizeDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onNow: () => void;
  onLater: () => void;
}> = ({ open, onClose, onNow, onLater }) => {
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
          <div className="shrink-0 mt-0.5 text-blue-600">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-900">
              Finalizar atendimento?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Escolha se deseja gerar a evolução agora ou deixar para preencher depois.
            </p>

            <div className="mt-4 grid gap-2">
              <button
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                onClick={onNow}
              >
                Gerar agora
              </button>

              <button
                className="inline-flex items-center justify-center rounded-lg bg-indigo-50 px-4 py-2 text-sm text-indigo-700 ring-1 ring-inset ring-indigo-200 hover:bg-indigo-100"
                onClick={onLater}
              >
                Preencher depois
              </button>

              <button
                className="inline-flex items-center justify-center rounded-lg  px-4 py-2 text-sm text-indigo-700 ring-1 ring-inset ring-black hover:bg-indigo-100"
                onClick={onClose}
                aria-label="Sair"
              >
                Sair
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
type Med = { name: string; freq?: string | null; duration?: string | null };

type DraftUI = {
  vitals: { bp?: string; hr?: string; temp?: string; weight?: string; height?: string };
  S: string;
  O: string;
  A: string;
  P: string;
  tags: string[];
  medications: Med[];
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
  const S = (s ?? "").toString().trim();
  const O = (o ?? "").toString().trim();
  const out = [O ? `Objetivo: ${O}` : "", S ? `Subjetivo: ${S}` : ""].filter(Boolean).join("\n");
  return out || undefined;
}

// ⛔ trava do "gerar agora"
function isDraftEmpty(d: DraftUI): boolean {
  const hasSOAP = (d.S || d.O || d.A || d.P).trim().length > 0;
  const hasVitals = anyVital(d.vitals || {});
  const hasTags = Array.isArray(d.tags) && d.tags.length > 0;
  const hasMeds = Array.isArray(d.medications) && d.medications.length > 0;
  return !(hasSOAP || hasVitals || hasTags || hasMeds);
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

/** Busca dados do profissional logado / do agendamento (prioriza o profissional da agenda). */
async function getProfessionalInfo(opts?: {
  appointmentId?: string;
  professionalName?: string;
}) {
  const appointmentId = opts?.appointmentId;
  const professionalName = opts?.professionalName;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id || null;

  let proId: string | null = null;
  let specialty: string | null = null;
  let profName: string | null = null;

  // 1) Tenta pelo appointment_slots.professional_id (mais confiável)
  if (appointmentId) {
    const { data: slot, error: slotError } = await supabase
      .from("appointment_slots")
      .select("professional_id") // ✅ essa coluna existe
      .eq("id", appointmentId)
      .maybeSingle();

    if (slotError) {
      console.warn("getProfessionalInfo slot error", slotError);
    }

    const slotProId = (slot as any)?.professional_id as string | undefined;

    if (slotProId) {
      const { data: proById, error: proByIdError } = await supabase
        .from("professionals")
        .select("id, name, specialty")
        .eq("id", slotProId)
        .maybeSingle();

      if (proByIdError) {
        console.warn("getProfessionalInfo professional by id error", proByIdError);
      }

      if (proById) {
        proId = (proById as any).id ?? proId;
        specialty = (proById as any).specialty ?? specialty;
        profName = (proById as any).name ?? profName;
      } else {
        proId = slotProId;
      }
    }
  }

  // 2) Se ainda faltar coisa, tenta bater pelo nome do profissional vindo da Agenda
  if (professionalName && (!proId || !specialty || !profName)) {
    const { data: proByName, error: proByNameError } = await supabase
      .from("professionals")
      .select("id, name, specialty")
      .ilike("name", professionalName)
      .limit(1)
      .maybeSingle();

    if (proByNameError) {
      console.warn("getProfessionalInfo professional by name error", proByNameError);
    }

    if (proByName) {
      if (!proId) proId = (proByName as any).id;
      if (!specialty) specialty = (proByName as any).specialty ?? specialty;
      if (!profName) profName = (proByName as any).name ?? profName;
    }
  }

  // 3) Fallback: tenta achar um professional cujo id seja o próprio userId
  if (userId && (!proId || !specialty || !profName)) {
    const { data: proOwner, error: proOwnerError } = await supabase
      .from("professionals")
      .select("id, name, specialty")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (proOwnerError) {
      console.warn("getProfessionalInfo professional by userId error", proOwnerError);
    }

    if (proOwner) {
      if (!proId) proId = (proOwner as any).id;
      if (!specialty) specialty = (proOwner as any).specialty ?? specialty;
      if (!profName) profName = (proOwner as any).name ?? profName;
    }
  }

  // 4) Fallback final só para NOME (profile)
  if (!profName && userId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    profName = (prof as any)?.name || profName;
  }

  return { userId, proId, role: specialty, profName };
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

  // toast padrão de finalização
  const showFinalizeToast = () => {
    toasts.success("Atendimento finalizado!", "Tudo certo");
  };

  // dados gerais
  const [appointmentId, setAppointmentId] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("Paciente");
  const [professionalName, setProfessionalName] = useState<string>("Profissional");
  const [serviceName, setServiceName] = useState<string>("Consulta");

  // vitais
  const [showVitals, setShowVitals] = useState<boolean>(() => {
    const saved = localStorage.getItem("live:vitalsVisible");
    return saved ? saved === "1" : false;
  });
  const toggleVitals = () => {
    setShowVitals((v) => {
      const nv = !v;
      localStorage.setItem("live:vitalsVisible", nv ? "1" : "0");
      return nv;
    });
  };

  // encounter id
  const [encounterId, setEncounterId] = useState<string | undefined>(() =>
    initialData?.encounterId || getEncounterIdFromURL()
  );

  // modal confirmar finalizar
  const [confirmOpen, setConfirmOpen] = useState(false);

  // pedido de auto-finalização (quando vem da Agenda)
  const [autoFinalizeRequested, setAutoFinalizeRequested] = useState(false);

  // autosave
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
      medications: Array.isArray(d?.medications) ? d.medications : [],
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
        medications: Array.isArray(prev?.medications) ? prev.medications : [],
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

  /* -------- Se veio autoFinalize da Agenda, finaliza no modo "agora" -------- */
  useEffect(() => {
    if (!autoFinalizeRequested) return;
    const t = setTimeout(() => {
      finalizeNow();
      setAutoFinalizeRequested(false);
    }, 250);
    return () => clearTimeout(t);
  }, [autoFinalizeRequested]);

  /* ===================== Finalizar + Evolução ===================== */
  const ensureEncounterAndCloseSlot = async (
    payloadForFinalize: any
  ): Promise<string | undefined> => {
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

    // 2) finalize_encounter
    const { error: finErr } = await supabase.rpc("finalize_encounter", {
      p_encounter_id: eid,
      p_options: payloadForFinalize,
    });
    if (finErr) throw finErr;

    // 3) Atualiza status do slot
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

    return eid;
  };

  const cleanMeds = (arr: Med[]) =>
    (arr || [])
      .map((m) => ({
        name: (m.name || "").trim(),
        freq: (m.freq || "")?.trim() || null,
        duration: (m.duration || "")?.trim() || null,
      }))
      .filter((m) => m.name.length > 0);

  /** Finaliza e cria evolução a partir do rascunho (fluxo “Gerar agora”) */
  const finalizeNow = async () => {
    // trava: não deixa gerar agora se estiver tudo vazio
    if (isDraftEmpty(draft)) {
      toasts.info("Preencha pelo menos um campo antes de gerar.", "Nada para gerar");
      return;
    }

    try {
      const plain =
        [
          draft.S && `S: ${draft.S}`,
          draft.O && `O: ${draft.O}`,
          draft.A && `A: ${draft.A}`,
          draft.P && `P: ${draft.P}`,
          anyVital(draft.vitals) &&
            `VITAIS: BP=${draft.vitals.bp || "-"} | FC=${draft.vitals.hr || "-"} | Temp=${
              draft.vitals.temp || "-"
            } | Peso=${draft.vitals.weight || "-"} | Alt=${draft.vitals.height || "-"}`,
          draft.tags.length ? `Tags: ${draft.tags.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n") || null;

      const eid = await ensureEncounterAndCloseSlot({
        data_json: draft,
        plain_text: plain,
      });
      if (!eid) return;

      // pega profissão/cargo e id do registro do profissional
      const { userId, proId, role, profName } = await getProfessionalInfo({
        appointmentId,
        professionalName,
      });

      const specialtyValue: string | null = role || null;

      // Cria evolução preenchida
      try {
        const patient_id = await findPatientId(patientName);
        const occurred_at = new Date().toISOString();
        const title = serviceName || "Consulta";

        const vitals = {
          bp: draft.vitals.bp || undefined,
          hr: draft.vitals.hr || undefined,
          temp: draft.vitals.temp || undefined,
          weight: draft.vitals.weight || undefined,
          height: draft.vitals.height || undefined,
        };

        const meds = cleanMeds(draft.medications || []);

        const evoInsertBase: any = {
          owner_id: userId!,
          patient_id,
          appointment_id: appointmentId || null,
          professional_id: proId ?? userId!,
          professional_name: professionalName || profName || "Profissional",
          specialty: specialtyValue,
          title,
          type: "consultation",
          occurred_at,
          vitals,
          symptoms: draft.tags || [],
          diagnosis: parseDiagnosisLines(draft.A),
          conduct: parseConduct(draft.P) ?? null,
          observations: parseObservations(draft.O, draft.S) ?? null,
          data_json: {
            vitals,
            S: draft.S || "",
            O: draft.O || "",
            A: draft.A || "",
            P: draft.P || "",
            tags: draft.tags || [],
            medications: meds,
            updatedAt: draft.updatedAt || new Date().toISOString(),
          },
          s_text: draft.S || null,
          o_text: draft.O || null,
          a_text: draft.A || null,
          p_text: draft.P || null,
          tags: draft.tags || [],
        };

        // tenta inserir COM medications
        let insErr = null;
        {
          const { error } = await supabase
            .from("patient_evolution")
            .insert([{ ...evoInsertBase, medications: meds }]);
          insErr = error || null;
        }

        // se coluna não existir, re-tenta SEM medications
        const medColMissing =
          insErr &&
          (insErr.code === "PGRST204" ||
            /medications.*(does not exist|could not find)/i.test(insErr.message || ""));
        if (medColMissing) {
          await supabase.from("patient_evolution").insert([evoInsertBase]);
        } else if (insErr) {
          console.warn("evolution insert failed:", insErr);
        }
      } catch (err) {
        console.warn("evolution creation warning:", err);
      }

      // sinaliza/limpa
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

      // 2) toast padrão
      showFinalizeToast();

      // 3) agora sim fecha, mas com um leve atraso pra dar tempo do toast aparecer
      window.dispatchEvent(new CustomEvent("agenda:refresh"));
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("encounter:close"));
      }, 3000);
    } catch (e) {
      console.warn("finalizeNow error:", e);
      toasts.error("Não foi possível finalizar agora. Tente novamente.");
    }
  };

  /** Finaliza e cria evolução em branco (fluxo “Preencher depois”) */
  const finalizeBlank = async () => {
    try {
      const eid = await ensureEncounterAndCloseSlot({
        data_json: {},
        plain_text: null,
      });
      if (!eid) return;

      // 1) toast de pendência
      toasts.info("Evolução criada em branco. Preencha quando puder.", "Evolução pendente");

      const { userId, proId, role, profName } = await getProfessionalInfo({
        appointmentId,
        professionalName,
      });

      const specialtyValue: string | null = role || null;

      // Cria evolução “vazia”
      try {
        const patient_id = await findPatientId(patientName);
        const occurred_at = new Date().toISOString();
        const title = serviceName || "Consulta";

        const evoInsert = {
          owner_id: userId!,
          patient_id,
          appointment_id: appointmentId || null,
          professional_id: proId ?? userId!,
          professional_name: professionalName || profName || "Profissional",
          specialty: specialtyValue,
          title,
          type: "consultation",
          occurred_at,
          vitals: {},
          symptoms: [] as string[],
          diagnosis: [] as string[],
          conduct: null as string | null,
          observations: null as string | null,
          data_json: {
            S: "",
            O: "",
            A: "",
            P: "",
            vitals: {},
            tags: [] as string[],
            medications: [] as Med[],
            updatedAt: new Date().toISOString(),
            pending: true,
          },
          s_text: null,
          o_text: null,
          a_text: null,
          p_text: null,
          tags: [] as string[],
        };

        await supabase.from("patient_evolution").insert([evoInsert]);
      } catch (err) {
        console.warn("evolution blank creation warning:", err);
      }

      // agenda
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

      // 2) toast de finalizado
      showFinalizeToast();

      window.dispatchEvent(new CustomEvent("agenda:refresh"));

      // 3) fecha com o mesmo atraso
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("encounter:close"));
      }, 3000);
    } catch (e) {
      console.warn("finalizeBlank error:", e);
      toasts.error("Não foi possível concluir. Tente novamente.");
    }
  };

  /* ===================== UI helpers ===================== */
  const setVital = (key: keyof DraftUI["vitals"], value: string) =>
    setDraft((d) => ({ ...d, vitals: { ...(d.vitals || {}), [key]: value } }));

  const addTag = (tag: string) =>
    setDraft((d) => ({ ...d, tags: Array.from(new Set([...(d.tags || []), tag])) }));

  const removeTag = (tag: string) =>
    setDraft((d) => ({ ...d, tags: (d.tags || []).filter((t) => t !== tag) }));

  const addMed = () =>
    setDraft((d) => ({ ...d, medications: [...(d.medications || []), { name: "" }] }));
  const setMed = (idx: number, patch: Partial<Med>) =>
    setDraft((d) => ({
      ...d,
      medications: (d.medications || []).map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  const delMed = (idx: number) =>
    setDraft((d) => ({ ...d, medications: (d.medications || []).filter((_, i) => i !== idx) }));

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Voltar */}
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
          <h3 className="text-lg font-bold text-gray-900">
            {professionalName || "Profissional"}
          </h3>
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
                onClick={toggleVitals}
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

          {/* MEDICAÇÕES */}
          <div className="mt-6 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <PillIcon className="w-4 h-4 text-violet-600" />
              <div className="text-sm font-semibold text-slate-700">Medicações</div>
            </div>

            <div className="mt-3 space-y-2">
              {(draft.medications || []).map((m, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <input
                    className="md:col-span-5 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Nome (ex.: sertralina 50mg)"
                    value={m.name || ""}
                    onChange={(e) => setMed(i, { name: e.target.value })}
                  />
                  <input
                    className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Frequência (ex.: 8/8h)"
                    value={m.freq || ""}
                    onChange={(e) => setMed(i, { freq: e.target.value })}
                  />
                  <input
                    className="md:col-span-3 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Duração (ex.: 7 dias)"
                    value={m.duration || ""}
                    onChange={(e) => setMed(i, { duration: e.target.value })}
                  />
                  <button
                    className="md:col-span-1 rounded-lg border border-rose-200 text-rose-700 px-3 py-2 text-sm hover:bg-rose-50"
                    onClick={() => delMed(i)}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <button
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-sm"
              onClick={addMed}
            >
              + Adicionar medicação
            </button>
          </div>
        </div>
      </div>

      {/* Modal Finalizar */}
      <FinalizeDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onNow={() => {
          setConfirmOpen(false);
          finalizeNow();
        }}
        onLater={() => {
          setConfirmOpen(false);
          finalizeBlank();
        }}
      />

      {/* Toasts */}
      <Toasts items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
