// src/components/Patients/PatientEvolutionTimeline.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  User2,
  Pill as PillIcon,
  ClipboardList,
  Activity,
  Thermometer,
  Scale,
  Ruler,
  Edit3,
  Trash2,
  Stethoscope,
  Clock,
  Heart,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { usePatientEvolutionFeed, EvolutionItem } from "../../hooks/usePatientEvolutionFeed";

/* ================= helpers ================= */
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function splitUnit(v: string): [string, string] {
  const m = (v || "").trim().match(/^(\d+(?:[\.,]\d+)?(?:\/\d+(?:[\.,]\d+)?)?)\s*(.*)$/);
  if (!m) return [v || "", ""];
  return [m[1], m[2] || ""];
}
const parseLines = (s: string) =>
  (s || "")
    .split(/\r?\n| - |•|,|;/g)
    .map((x) => x.trim())
    .filter(Boolean);

function fromObs(obs: string, key: "S" | "O"): string {
  const re = key === "S" ? /Subjetivo:\s*([\s\S]*)/i : /Objetivo:\s*([\s\S]*)/i;
  const m = (obs || "").match(re);
  if (!m) return "";
  const cutRe = key === "S" ? /Objetivo:/i : /Subjetivo:/i;
  return m[1].split(cutRe)[0].trim();
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{children}</div>;
}
function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700 break-words max-w-full">
      {children}
    </span>
  );
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <SectionTitle>{title}</SectionTitle>
      <div
        className="text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {children}
      </div>
    </div>
  );
}

/* ============ vitais (render da timeline) ============ */
function VitalGroup({
  items,
}: {
  items: Array<{ icon: React.ReactNode; label: string; value?: string }>;
}) {
  const visible = items.filter((i) => i.value && String(i.value).trim().length);
  if (!visible.length) return null;
  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
      <div className="grid grid-cols-4 gap-3">
        {visible.map((it, i) => (
          <VitalInline key={`vital-${i}`} icon={it.icon} label={it.label} value={it.value!} />
        ))}
      </div>
    </div>
  );
}
function VitalInline({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [num, unit] = splitUnit(value);
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 leading-tight flex items-baseline justify-center gap-1 whitespace-nowrap">
        <span className="text-sm font-semibold text-gray-800">{num}</span>
        {unit && <span className="text-xs text-gray-600">{unit}</span>}
      </div>
    </div>
  );
}

/* ================= tipos ================= */
type Med = { name: string; freq?: string | null; duration?: string | null };

/* ================= ConfirmDialog ================= */
function ConfirmDialog({
  open,
  title = "Confirmar",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
      <div
        className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-black/10 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-700">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Editor (igual ao LiveEncounter) ================= */
type EditState = {
  id: string;
  title: string;
  vitals: { bp?: string; hr?: string; temp?: string; weight?: string; height?: string };
  S: string;
  O: string;
  A: string;
  P: string;
  tagsText: string;
  tags: string[];
  medications: Med[];
  pending?: boolean;
};

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 rounded-lg text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
    >
      {children}
    </button>
  );
}
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon}
        {title}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EditModal({
  open,
  initial,
  onClose,
  onSaved,
  askDelete,
}: {
  open: boolean;
  initial: EditState | null;
  onClose: () => void;
  onSaved: () => void;
  askDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<EditState | null>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(initial), [initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const computedPending = useMemo(() => {
    const f = form;
    if (!f) return true;
    const hasVitals =
      !!f.vitals.bp || !!f.vitals.hr || !!f.vitals.temp || !!f.vitals.weight || !!f.vitals.height;
    const hasSOAP =
      f.S.trim() || f.O.trim() || f.A.trim() || f.P.trim() ||
      (f.tags?.length ?? 0) > 0 || (f.medications?.length ?? 0) > 0;
    return !(hasVitals || hasSOAP);
  }, [form]);

  if (!open || !form) return null;

  // vitais
  const setVital = (k: keyof EditState["vitals"], v: string) =>
    setForm((f) => (f ? { ...f, vitals: { ...(f.vitals || {}), [k]: v } } : f));

  // tags
  const addQuickTag = (t: string) =>
    setForm((f) =>
      f
        ? { ...f, tags: Array.from(new Set([...(f.tags || []), t])), tagsText: [...(f.tags || []), t].join("\n") }
        : f
    );
  const removeTag = (t: string) =>
    setForm((f) =>
      f
        ? { ...f, tags: (f.tags || []).filter((x) => x !== t), tagsText: (f.tags || []).filter((x) => x !== t).join("\n") }
        : f
    );

  // meds
  const addMed = () =>
    setForm((f) => (f ? { ...f, medications: [...(f.medications || []), { name: "" }] } : f));
  const setMed = (idx: number, patch: Partial<Med>) =>
    setForm((f) =>
      f
        ? {
            ...f,
            medications: (f.medications || []).map((m, i) => (i === idx ? { ...m, ...patch } : m)),
          }
        : f
    );
  const delMed = (idx: number) =>
    setForm((f) => (f ? { ...f, medications: (f.medications || []).filter((_, i) => i !== idx) } : f));

  // salvar
  const doSave = async () => {
    try {
      setSaving(true);

      const S = (form.S || "").trim();
      const O = (form.O || "").trim();
      const A = (form.A || "").trim();
      const P = (form.P || "").trim();

      const diagnosisArr = parseLines(A);
      const symptomsArr = (form.tags || []).filter(Boolean);

      const observations =
        [
          O ? `Objetivo: ${O}` : "",
          S ? `Subjetivo: ${S}` : "",
        ]
          .filter(Boolean)
          .join("\n") || null;

      const conduct = P || null;
      const nextSteps = null;

      const cleanMeds =
        (form.medications || [])
          .map((m) => ({
            name: (m.name || "").trim(),
            freq: (m.freq || "")?.trim() || null,
            duration: (m.duration || "")?.trim() || null,
          }))
          .filter((m) => m.name.length > 0);

      const pending =
        !(
          S || O || A || P ||
          symptomsArr.length || diagnosisArr.length ||
          cleanMeds.length ||
          form.vitals.bp || form.vitals.hr || form.vitals.temp || form.vitals.weight || form.vitals.height
        );

      const baseUpdate: any = {
        title: form.title || "Consulta",
        vitals: form.vitals || {},
        symptoms: symptomsArr,
        diagnosis: diagnosisArr,
        observations,
        conduct,
        next_steps: nextSteps,
        data_json: {
          vitals: form.vitals || {},
          S, O, A, P,
          tags: symptomsArr,
          medications: cleanMeds,
          updatedAt: new Date().toISOString(),
          pending,
        },
        s_text: S || null,
        o_text: O || null,
        a_text: A || null,
        p_text: P || null,
        tags: symptomsArr,
      };

      let { error } = await supabase
        .from("patient_evolution")
        .update({ ...baseUpdate, medications: cleanMeds })
        .eq("id", form.id);

      const missingMedCol =
        error &&
        (error.code === "PGRST204" ||
          /medications.*(does not exist|could not find)/i.test(error.message || ""));
      if (missingMedCol) {
        const retry = await supabase
          .from("patient_evolution")
          .update(baseUpdate)
          .eq("id", form.id);
        error = retry.error || null;
      }

      if (error) throw error;

      onSaved?.();
      onClose();
      window.dispatchEvent(new CustomEvent("timeline:refresh"));
    } catch (e) {
      console.warn("save evolution error:", e);
      alert("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-0" />
      <div
        className="
          relative z-10 w-full sm:w-auto max-w-[100vw] sm:max-w-3xl
          bg-white rounded-t-2xl sm:rounded-2xl shadow-xl ring-1 ring-black/10
          max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-3 sm:px-4 py-3 border-b flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Editar evolução</h3>
            <span
              className={[
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1",
                (form?.pending ?? computedPending)
                  ? "bg-amber-50 text-amber-700 ring-orange-600"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200",
              ].join(" ")}
              title="Status calculado automaticamente"
            >
              <Clock className="w-3.5 h-3.5" />
              {(form?.pending ?? computedPending) ? "Pendente" : "Concluída"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => askDelete(form!.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 text-rose-700 px-2.5 py-1.5 text-sm hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
            <button
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 text-slate-700 px-2.5 py-1.5 text-sm hover:bg-slate-50"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          </div>
        </div>

        {/* conteúdo */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4">
          {/* título */}
          <div>
            <label className="text-xs font-semibold text-slate-600">Título</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form?.title || ""}
              onChange={(e) => setForm({ ...(form as EditState), title: e.target.value })}
              placeholder="Ex.: Consulta de acompanhamento"
            />
          </div>

          {/* VITAIS */}
          <Card title="SINAIS VITAIS" icon={<Activity className="w-4 h-4 text-indigo-600" />}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">Pressão</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="120/80"
                  value={form?.vitals.bp || ""}
                  onChange={(e) => setVital("bp", e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  {["120/80", "130/85", "110/70"].map((v) => (
                    <Chip key={v} onClick={() => setVital("bp", v)}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">FC</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="72 bpm"
                  value={form?.vitals.hr || ""}
                  onChange={(e) => setVital("hr", e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  {["68 bpm", "72 bpm", "78 bpm"].map((v) => (
                    <Chip key={v} onClick={() => setVital("hr", v)}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">Temp.</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="36.5 °C"
                  value={form?.vitals.temp || ""}
                  onChange={(e) => setVital("temp", e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  {["36.3 °C", "36.5 °C", "37.0 °C"].map((v) => (
                    <Chip key={v} onClick={() => setVital("temp", v)}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">Peso</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="78.5 kg"
                  value={form?.vitals.weight || ""}
                  onChange={(e) => setVital("weight", e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  {["70 kg", "78.5 kg", "80 kg"].map((v) => (
                    <Chip key={v} onClick={() => setVital("weight", v)}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-1">Altura</div>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="175 cm"
                  value={form?.vitals.height || ""}
                  onChange={(e) => setVital("height", e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  {["170 cm", "175 cm", "180 cm"].map((v) => (
                    <Chip key={v} onClick={() => setVital("height", v)}>{v}</Chip>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* SOAP */}
          <Card title="S — Subjetivo (relato do paciente)">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Digite aqui…"
              value={form?.S || ""}
              onChange={(e) => setForm({ ...(form as EditState), S: e.target.value })}
            />
          </Card>

          <Card title="O — Objetivo (exame/achados)">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Digite aqui…"
              value={form?.O || ""}
              onChange={(e) => setForm({ ...(form as EditState), O: e.target.value })}
            />
          </Card>

          <Card title="A — Avaliação (diagnóstico/CID)">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Digite aqui… (um por linha)"
              value={form?.A || ""}
              onChange={(e) => setForm({ ...(form as EditState), A: e.target.value })}
            />
          </Card>

          <Card title="P — Plano (conduta/medicação/próximos passos)">
            <textarea
              className="w-full min-h-[100px] rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Digite aqui…"
              value={form?.P || ""}
              onChange={(e) => setForm({ ...(form as EditState), P: e.target.value })}
            />
          </Card>

          {/* Tags */}
          <div>
            <SectionTitle>Sintomas/Tags</SectionTitle>
            <textarea
              className="w-full min-h-[90px] rounded-lg border border-slate-300 px-3 py-2"
              placeholder={"Adicionar tag (ex.: ‘Ansiedade leve’)\nou separe por vírgula/linha"}
              value={form?.tagsText || ""}
              onChange={(e) =>
                setForm({
                  ...(form as EditState),
                  tagsText: e.target.value,
                  tags: parseLines(e.target.value),
                })
              }
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {["Ansiedade leve", "Insônia", "Cefaleia", "Check-up"].map((tag) => (
                <Chip key={tag} onClick={() => addQuickTag(tag)}>{tag}</Chip>
              ))}
              {(form?.tags || []).map((t) => (
                <span key={t} className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs inline-flex items-center gap-2">
                  {t}
                  <button onClick={() => removeTag(t)} aria-label={`Remover ${t}`}>×</button>
                </span>
              ))}
            </div>
          </div>

          {/* Medicações */}
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <PillIcon className="w-4 h-4 text-violet-600" />
              <div className="text-sm font-semibold text-slate-700">Medicações</div>
            </div>

            <div className="mt-3 space-y-2">
              {(form?.medications || []).map((m, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <input
                    className="sm:col-span-5 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Nome (ex.: sertralina 50mg)"
                    value={m.name || ""}
                    onChange={(e) => setMed(i, { name: e.target.value })}
                  />
                  <input
                    className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Frequência (ex.: 8/8h)"
                    value={m.freq || ""}
                    onChange={(e) => setMed(i, { freq: e.target.value })}
                  />
                  <input
                    className="sm:col-span-3 rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Duração (ex.: 7 dias)"
                    value={m.duration || ""}
                    onChange={(e) => setMed(i, { duration: e.target.value })}
                  />
                  <button
                    className="sm:col-span-1 rounded-lg border border-rose-200 text-rose-700 px-3 py-2 text-sm hover:bg-rose-50"
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

        {/* footer */}
        <div className="border-t px-3 sm:px-4 py-2 sm:py-3 bg-white flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-300 px-3 py-2 text-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={doSave}
            disabled={saving}
            className="w-full sm:w-auto rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar evolução"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Timeline (cards) ================= */
export default function PatientEvolutionTimeline({ patientId }: { patientId: string }) {
  const { data, loading, error } = usePatientEvolutionFeed(patientId);

  // Mapa de especialidades por profissional (resolve specialty quando vier nulo)
  const [rolesMap, setRolesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (!data?.length) return;

      // ids armazenados em patient_evolution.professional_id
      const ids = Array.from(
        new Set(
          data.map((it) => (it as any).professional_id).filter(Boolean)
        )
      ) as string[];
      if (!ids.length) return;

      // 1) busca pelo professionals.id (correto)
      const { data: byId } = await supabase
        .from("professionals")
        .select("id, specialty")
        .in("id", ids);

      // 2) fallback: alguns registros antigos podem ter owner_id salvo no professional_id
      const { data: byOwner } = await supabase
        .from("professionals")
        .select("owner_id, specialty")
        .in("owner_id", ids);

      const map: Record<string, string> = {};
      (byId || []).forEach((p: any) => {
        if (p?.id && p?.specialty) map[p.id] = String(p.specialty).trim();
      });
      (byOwner || []).forEach((p: any) => {
        if (p?.owner_id && p?.specialty && !map[p.owner_id]) map[p.owner_id] = String(p.specialty).trim();
      });

      setRolesMap(map);
    })();
  }, [data]);

  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<EditState | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);

  const openEditor = (item: EvolutionItem, isPending: boolean) => {
    const dj: any = (item as any)?.data_json || {};
    const v = (item as any).vitals || dj.vitals || {};
    const tagsArr: string[] = (item as any).symptoms || dj.tags || [];
    const meds: Med[] = (item as any).medications || dj.medications || [];
    const observations = (item as any).observations || "";

    const S_raw = dj.S || dj.subjective || (item as any).s_text || fromObs(observations, "S");
    const O_raw = dj.O || dj.objective || (item as any).o_text || fromObs(observations, "O");

    setEditInitial({
      id: item.id,
      title: item.title || "Consulta",
      vitals: {
        bp: v.bp || "",
        hr: v.hr || "",
        temp: v.temp || "",
        weight: v.weight || "",
        height: v.height || "",
      },
      S: S_raw || "",
      O: O_raw || "",
      A: dj.A || dj.assessment || (((item as any).diagnosis || []) as string[]).join("\n"),
      P: dj.P || dj.plan || ((item as any).conduct || (item as any).next_steps || ""),
      tags: Array.isArray(tagsArr) ? tagsArr : [],
      tagsText: Array.isArray(tagsArr) ? tagsArr.join("\n") : "",
      medications: Array.isArray(meds) ? meds : [],
      pending: isPending || dj.pending === true,
    });
    setEditOpen(true);
  };

  const requestDelete = (id: string) => {
    setToDeleteId(id);
    setConfirmOpen(true);
  };

  const performDelete = async () => {
    if (!toDeleteId) return;
    try {
      const { error } = await supabase.from("patient_evolution").delete().eq("id", toDeleteId);
      if (error) throw error;
      window.dispatchEvent(new CustomEvent("timeline:refresh"));
    } catch (e) {
      console.warn("delete evolution error:", e);
      alert("Falha ao excluir. Tente novamente.");
    } finally {
      setConfirmOpen(false);
      setToDeleteId(null);
      setEditOpen(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-600">Carregando…</div>;
  if (error) return <div className="text-sm text-red-600">Falha ao carregar a evolução.</div>;
  if (!data?.length) return <div className="text-sm text-gray-600">Sem evoluções por aqui ainda.</div>;

  return (
    <div className="relative -ml-4 sm:-ml-6">
      <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-slate-200" />
      <div className="space-y-6 pl-1 sm:pl-2">
        {data.map((item: EvolutionItem) => {
          const v = (item as any).vitals || {};
          const meds = ((item as any).medications || []) as Med[];

          const hasVitals = v.bp || v.hr || v.temp || v.weight || v.height;
          const hasSOAP =
            (item as any).symptoms?.length > 0 ||
            (item as any).diagnosis?.length > 0 ||
            !!(item as any).conduct ||
            !!(item as any).observations ||
            meds.length > 0 ||
            !!(item as any).next_steps;

          const isPending =
            (item as any)?.data_json?.pending === true ||
            (item as any)?.pending === true ||
            (item as any)?.status === "pending" ||
            (!hasVitals && !hasSOAP);

          // especialidade: prioriza tabela professionals (via rolesMap) -> legados
          const specialty =
            rolesMap[String((item as any).professional_id)] ??
            (item as any).professional_specialty ??
            (item as any).professional_role ??
            (item as any).specialty;

          return (
            <div className="relative flex flex-nowrap items-start gap-3 md:gap-4" key={item.id}>
              <div className="pt-1 w-10 shrink-0">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center ring-4 ring-white">
                  <Stethoscope className="w-5 h-5" />
                </div>
              </div>

              {/* wrapper com ações */}
              <div className="flex-1 min-w-0 -ml-1 md:-ml-3 relative overflow-x-hidden overflow-y-visible group">
                <div
                  className="
                    absolute -right-1 top-0 bottom-0
                    flex flex-col justify-center gap-3 pr-4
                    bg-white z-10
                    translate-x-[150%] group-[.show]:translate-x-0
                    transition-transform duration-300 ease-in-out
                    pointer-events-none will-change-transform
                  "
                >
                  <button
                    className="h-14 w-14 grid place-items-center text-white rounded-2xl bg-indigo-600 shadow-xl ring-1 ring-black/5 hover:bg-indigo-700 transition pointer-events-auto"
                    title={isPending ? "Preencher evolução" : "Editar evolução"}
                    onClick={() => openEditor(item, isPending)}
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    className="h-14 w-14 grid place-items-center text-white rounded-2xl bg-red-600 shadow-xl ring-1 ring-black/5 hover:bg-red-700 transition pointer-events-auto"
                    title="Excluir evolução"
                    onClick={() => requestDelete(item.id)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* card */}
                <div
                  className={[
                    "rounded-2xl bg-white border p-4 shadow-sm transform transition-transform duration-300 ease-in-out group-[.show]:-translate-x-20",
                    isPending ? "border-orange-700 ring-1 ring-orange-600/60" : "border-slate-200",
                  ].join(" ")}
                  onTouchStart={(e) => {
                    (e.currentTarget as any).dataset.startX = e.touches[0].clientX.toString();
                  }}
                  onTouchEnd={(e) => {
                    const startX = parseFloat((e.currentTarget as any).dataset.startX || "0");
                    const endX = e.changedTouches[0].clientX;
                    const delta = startX - endX;
                    if (delta > 30) e.currentTarget.parentElement?.classList.add("show");
                    if (delta < -30) e.currentTarget.parentElement?.classList.remove("show");
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as any).dataset.startX = e.clientX.toString();
                  }}
                  onMouseUp={(e) => {
                    const startX = parseFloat((e.currentTarget as any).dataset.startX || "0");
                    const endX = e.clientX;
                    const delta = startX - endX;
                    if (delta > 30) e.currentTarget.parentElement?.classList.add("show");
                    if (delta < -30) e.currentTarget.parentElement?.classList.remove("show");
                  }}
                >
                  {/* header (título + badge na mesma linha, responsivo) */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* Linha 1: título e badge (quebra controlada no mobile) */}
                      <div className="flex flex-wrap items-start gap-2">
                        <div
                          className="text-lg font-bold text-gray-900 w-full sm:flex-auto min-w-0 whitespace-normal"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {item.title || "Consulta de Acompanhamento"}
                        </div>
                        {specialty && (
                          <span
                            className="shrink-0 inline-flex items-center rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold border border-blue-200 sm:ml-auto"
                            title={specialty}
                          >
                            {specialty}
                          </span>
                        )}
                      </div>

                      {/* Linha 2: data/hora + nome do profissional por extenso */}
                      <div className="mt-1 flex flex-wrap items-start gap-x-3 gap-y-1 text-sm text-gray-600">
                        <span className="inline-flex items-start gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-400 mt-0.5" />
                          <span className="leading-tight">
                            <div>{fmtDate(item.occurred_at)}</div>
                            <div className="text-xs">{fmtTime(item.occurred_at)}</div>
                          </span>
                        </span>

                        {item.professional_name && (
                          <span className="inline-flex items-start gap-2 min-w-0">
                            <User2 className="w-4 h-4 text-slate-400 mt-[2px]" />
                            <span
                              className="leading-tight text-gray-700 max-w-[68vw] sm:max-w-[360px] truncate"
                              title={item.professional_name}
                            >
                              {item.professional_name}
                            </span>
                          </span>
                        )}
                      </div>

                      {isPending && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-lg orange-50 text-orange-700 px-2 py-1 ring-1 ring-orange-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs font-medium">Evolução pendente de preenchimento</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* vitais */}
                  {(v.bp || v.hr || v.temp || v.weight || v.height) && (
                    <VitalGroup
                      items={[
                        { icon: <Activity className="w-4 h-4 text-slate-400" />, label: "Pressão", value: (v as any).bp },
                        { icon: <Heart className="w-4 h-4 text-slate-400" />, label: "FC", value: (v as any).hr },
                        { icon: <Thermometer className="w-4 h-4 text-slate-400" />, label: "Temp.", value: (v as any).temp },
                        { icon: <Scale className="w-4 h-4 text-slate-400" />, label: "Peso", value: (v as any).weight },
                        { icon: <Ruler className="w-4 h-4 text-slate-400" />, label: "Altura", value: (v as any).height },
                      ]}
                    />
                  )}

                  {/* conteúdo */}
                  {((item as any).symptoms?.length > 0 ||
                    (item as any).diagnosis?.length > 0 ||
                    (item as any).conduct ||
                    (item as any).observations ||
                    meds.length > 0 ||
                    (item as any).next_steps) && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                        <div>
                          <SectionTitle>Sintomas</SectionTitle>
                          {(item as any).symptoms?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {(item as any).symptoms.map((t: string, i: number) => (
                                <TagPill key={`${item.id}-sym-${i}`}>{t}</TagPill>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">—</div>
                          )}
                        </div>

                        <div>
                          <SectionTitle>Diagnóstico</SectionTitle>
                          {(item as any).diagnosis?.length ? (
                            <div
                              className="text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed break-words"
                              style={{ overflowWrap: "anywhere" }}
                            >
                              {(item as any).diagnosis.join("\n")}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">—</div>
                          )}
                        </div>
                      </div>

                      {(item as any).conduct && <Box title="Conduta">{(item as any).conduct}</Box>}

                      {meds.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <SectionTitle>Medicações</SectionTitle>
                          <ul className="space-y-2">
                            {meds.map((m: Med, i: number) => (
                              <li
                                key={`${item.id}-med-${i}`}
                                className="flex items-start gap-2 rounded-xl bg-violet-50 text-violet-900 p-2"
                              >
                                <PillIcon className="w-4 h-4 mt-0.5" />
                                <div className="text-sm min-w-0">
                                  <div className="font-semibold text-gray-800 break-words" style={{ overflowWrap: "anywhere" }}>
                                    {m.name}
                                  </div>
                                  {(m.freq || m.duration) && (
                                    <div className="text-[12px] text-gray-700/80 break-words">
                                      {m.freq ?? ""}{m.freq && m.duration ? " • " : ""}{m.duration ?? ""}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(item as any).observations && (
                        <div>
                          <SectionTitle>Observações</SectionTitle>
                          <div
                            className="text-sm font-normal text-gray-700 whitespace-pre-wrap leading-relaxed break-words"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {(item as any).observations}
                          </div>
                        </div>
                      )}

                      {(item as any).next_steps && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-blue-500" />
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Próximos passos</div>
                          </div>
                          <div
                            className="mt-1 text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed break-words"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {(item as any).next_steps}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* modal de edição */}
      <EditModal
        open={editOpen}
        initial={editInitial}
        onClose={() => setEditOpen(false)}
        onSaved={() => {}}
        askDelete={(id) => requestDelete(id)}
      />

      {/* confirmação de exclusão */}
      <ConfirmDialog
        open={confirmOpen}
        title="Excluir evolução"
        message="Deseja realmente excluir esta evolução? Essa ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={performDelete}
        onCancel={() => {
          setConfirmOpen(false);
          setToDeleteId(null);
        }}
      />
    </div>
  );
}
