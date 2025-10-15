// src/pages/CertificateNew.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Eye, Download, Printer, Plus, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import CertificatePreview from "../components/Certificates/CertificatePreview";

/* ============================================================
   Tipos
   ============================================================ */
type CertificateType = "saude" | "comparecimento" | "afastamento" | "aptidao" | "incapacidade";

export type CertificateFormData = {
  // Paciente
  patientName: string;
  patientCPF?: string;
  patientPhone?: string;
  patientBirthISO?: string;

  // Profissional
  professionalName: string;
  professionalSpecialty?: string;
  professionalCRM?: string;

  // Clínica
  clinicName?: string;
  clinicCNPJ?: string;

  // Atestado
  certificateType: CertificateType;
  reason: string;
  startDate?: string;
  endDate?: string;
  daysOfAbsence?: number;
  observations?: string;
  issueDate: string;

  // Opções
  isPaid?: boolean;
  requiresRest?: boolean;
  restrictedActivities?: string;
  includeSignature?: boolean;
  includeQRCode?: boolean;
};

type Props = {
  onBack: () => void;
  onCreated?: (certificateId: string) => void;
  initialData?: Partial<CertificateFormData> & { patientId?: string; professionalId?: string };
};

type SavedRow = CertificateFormData & { id: string; createdAt: string };

/* ============================================================
   Helpers
   ============================================================ */
function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const daysBetweenInclusive = (start?: string, end?: string) => {
  if (!start || !end) return undefined;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const ms = e.getTime() - s.getTime();
  if (isNaN(ms)) return undefined;
  return Math.max(1, Math.floor(ms / 86400000) + 1);
};

const onlyDigits = (s?: string | null) => (s || "").replace(/\D+/g, "");
const formatCPF = (v?: string | null) => {
  const d = onlyDigits(v);
  if (d.length !== 11) return v || "";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};
const formatPhoneBR = (v?: string | null) => {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/^(\d{2})(\d)(\d{4})(\d{4})$/, "($1) $2 $3-$4");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return v || "";
};
const isoToBR = (iso?: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
};

/* ============================================================
   AsyncSearchSelect
   ============================================================ */
type AsyncOption<T> = { key: string; label: React.ReactNode; raw: T };

function AsyncSearchSelect<T>({
  label,
  placeholder,
  valueLabel,
  onClear,
  onSearch,
  onSelect,
}: {
  label: string;
  placeholder: string;
  valueLabel?: string | null;
  onClear?: () => void;
  onSearch: (q: string) => Promise<AsyncOption<T>[]>;
  onSelect: (opt: AsyncOption<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 300);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AsyncOption<T>[]>([]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      const query = debounced.trim();
      if (!query || query.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await onSearch(query);
        if (!canceled) setOptions(res);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [debounced, onSearch]);

  return (
    <div className="relative">
      <span className="block text-sm font-semibold text-gray-700 mb-2">{label}</span>

      {valueLabel ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 bg-gray-50">
          <div className="truncate text-sm">{valueLabel}</div>
          <button
            className="text-xs text-blue-600 hover:underline ml-3"
            onClick={() => {
              onClear?.();
              setQ("");
              setOptions([]);
              setOpen(false);
            }}
          >
            limpar
          </button>
        </div>
      ) : (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
        />
      )}

      {open && !valueLabel && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">Buscando…</div>
          ) : options.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">Nenhum resultado</div>
          ) : (
            <ul className="py-1">
              {options.map((o) => (
                <li key={o.key}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    onClick={() => {
                      onSelect(o);
                      setOpen(false);
                      setQ("");
                      setOptions([]);
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Busca no Supabase
   ============================================================ */
async function searchPatientsSupabase(q: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;

  let query = supabase
    .from("patients")
    .select("id, name, cpf, phone, birth_date")
    .limit(50)
    .order("name");

  // Remova se sua tabela não tiver owner_id
  if (uid) query = query.eq("owner_id", uid);

  const digits = q.replace(/\D+/g, "");
  const orParts = [`name.ilike.%${q}%`];
  if (digits) {
    orParts.push(`cpf.ilike.%${digits}%`);
    orParts.push(`phone.ilike.%${digits}%`);
  }
  query = query.or(orParts.join(","));

  const { data, error } = await query;
  if (error) {
    console.warn("searchPatients error:", error);
    return [] as AsyncOption<any>[];
  }
  return (data || []).map((p: any) => ({
    key: p.id,
    label: (
      <div className="flex flex-col">
        <span className="font-medium">{p.name}</span>
        <span className="text-xs text-gray-600">
          {p.cpf ? `CPF: ${formatCPF(p.cpf)}` : ""}
          {p.phone ? ` • ${formatPhoneBR(p.phone)}` : ""}
          {p.birth_date ? ` • Nasc: ${isoToBR(p.birth_date)}` : ""}
        </span>
      </div>
    ),
    raw: p,
  }));
}

async function searchProfessionalsSupabase(q: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;

  let query = supabase
    .from("professionals")
    .select("id, name, specialty, registration_code, phone")
    .limit(50)
    .order("name");

  if (uid) query = query.eq("owner_id", uid); // remova se não existir

  const digits = q.replace(/\D+/g, "");
  const orParts = [`name.ilike.%${q}%`];
  if (digits) {
    orParts.push(`registration_code.ilike.%${digits}%`);
    orParts.push(`phone.ilike.%${digits}%`);
  }
  query = query.or(orParts.join(","));

  const { data, error } = await query;
  if (error) {
    console.warn("searchProfessionals error:", error);
    return [] as AsyncOption<any>[];
  }
  return (data || []).map((p: any) => ({
    key: p.id,
    label: (
      <div className="flex flex-col">
        <span className="font-medium">{p.name}</span>
        <span className="text-xs text-gray-600">
          {p.specialty ? p.specialty : ""}
          {p.registration_code ? ` • ${p.registration_code}` : ""}
          {p.phone ? ` • ${formatPhoneBR(p.phone)}` : ""}
        </span>
      </div>
    ),
    raw: p,
  }));
}

/* ============================================================
   Campos controlados (fix travamentos)
   ============================================================ */
type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string };
const Field = ({ label, className, value, onChange, ...rest }: FieldProps) => (
  <label className="block">
    <span className="block text-sm font-semibold text-gray-700 mb-2">{label}</span>
    <input
      {...rest}
      value={(value as string | number | undefined) ?? ""}
      onChange={onChange}
      className={
        "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
        (className || "")
      }
    />
  </label>
);

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };
const TextArea = ({ label, className, value, onChange, ...rest }: TextAreaProps) => (
  <label className="block">
    <span className="block text-sm font-semibold text-gray-700 mb-2">{label}</span>
    <textarea
      {...rest}
      value={(value as string | undefined) ?? ""}
      onChange={onChange}
      className={
        "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none " +
        (className || "")
      }
    />
  </label>
);

/* ============================================================
   Cartões de resumo
   ============================================================ */
function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 ml-4">{value}</span>
    </div>
  );
}
function SummaryCard({
  title,
  onChange,
  children,
}: {
  title: string;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <button type="button" className="text-xs font-medium text-blue-600 hover:underline" onClick={onChange}>
          Trocar
        </button>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

/* ============================================================
   Página
   ============================================================ */
export default function CertificateNew({ onBack, onCreated, initialData }: Props) {
  const [activeTab, setActiveTab] = useState<"form" | "preview" | "history">("form");
  const printRef = useRef<HTMLDivElement | null>(null);

  const [patientId, setPatientId] = useState<string>(String((initialData as any)?.patientId || ""));
  const [professionalId, setProfessionalId] = useState<string>(String((initialData as any)?.professionalId || ""));

  const [form, setForm] = useState<CertificateFormData>(() => ({
    patientName: initialData?.patientName || "",
    patientCPF: initialData?.patientCPF || "",
    patientPhone: initialData?.patientPhone || "",
    patientBirthISO: initialData?.patientBirthISO || "",
    professionalName: initialData?.professionalName || "",
    professionalSpecialty: initialData?.professionalSpecialty || "",
    professionalCRM: initialData?.professionalCRM || "",
    clinicName: initialData?.clinicName || "",
    clinicCNPJ: initialData?.clinicCNPJ || "",
    certificateType: (initialData?.certificateType as CertificateType) || "saude",
    reason: initialData?.reason || "Consulta médica",
    startDate: initialData?.startDate || new Date().toISOString().slice(0, 10),
    endDate: initialData?.endDate || new Date().toISOString().slice(0, 10),
    daysOfAbsence: initialData?.daysOfAbsence ?? 1,
    observations: initialData?.observations || "",
    issueDate: initialData?.issueDate || new Date().toISOString().slice(0, 10),
    isPaid: initialData?.isPaid ?? true,
    requiresRest: initialData?.requiresRest ?? false,
    restrictedActivities: initialData?.restrictedActivities || "",
    includeSignature: initialData?.includeSignature ?? true,
    includeQRCode: initialData?.includeQRCode ?? false,
  }));

  const [history, setHistory] = useState<SavedRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Carrega html2pdf
  useEffect(() => {
    if ((window as any).html2pdf) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Carrega nome da clínica/CNPJ do perfil do usuário
 // Carrega nome da clínica/CNPJ do perfil do usuário
useEffect(() => {
  let canceled = false;
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('clinic_name, clinic_cnpj')
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;
      if (!canceled && data) {
        setForm(prev => ({
          ...prev,
          // se já tiver um valor "bom", mantém; se estiver vazio/placeholder, usa o do perfil
          clinicName: prev.clinicName?.trim()
            ? prev.clinicName
            : (data.clinic_name ?? ''),
          clinicCNPJ: prev.clinicCNPJ?.trim()
            ? prev.clinicCNPJ
            : (data.clinic_cnpj ?? ''),
        }));
      }
    } catch (err) {
      console.warn('load clinic from profile error:', err);
    }
  })();
  return () => { canceled = true; };
}, []);


  // Ações
  const handlePrint = () => window.print();

  const handleDownloadPDF = () => {
    const w = (window as any);
    if (w.html2pdf && printRef.current) {
      const opt = {
        margin: 10,
        filename: `Atestado_${(form.patientName || "Paciente").replace(/\s+/g, "_")}_${Date.now()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };
      w.html2pdf().set(opt).from(printRef.current).save();
    } else {
      window.print();
    }
  };

  // Cabeçalho: voltar com comportamento inteligente
  const handleHeaderBack = useCallback(() => {
    if (activeTab !== "form") {
      setActiveTab("form");
      return;
    }
    onBack();
  }, [activeTab, onBack]);

  // Mapeamento -> DB
  const CERT_TYPES_LABEL_DB: Record<CertificateType, string> = {
    saude: "Atestado de Saúde",
    comparecimento: "Atestado de Comparecimento",
    afastamento: "Atestado de Afastamento",
    aptidao: "Atestado de Aptidão",
    incapacidade: "Atestado de Incapacidade",
  };
  const buildDbTitle = (d: CertificateFormData) =>
    `${CERT_TYPES_LABEL_DB[d.certificateType] || "Atestado"} - ${d.patientName}`;
  const buildDbDuration = (d: CertificateFormData) =>
    ["afastamento", "incapacidade"].includes(d.certificateType)
      ? `${d.daysOfAbsence ?? 1} dia${(d.daysOfAbsence ?? 1) > 1 ? "s" : ""}`
      : null;
  const buildDbDescription = (d: CertificateFormData) => {
    const parts: string[] = [];
    parts.push(`Motivo: ${d.reason}.`);
    parts.push(`Emitido em: ${isoToBR(d.issueDate)}.`);
    if (["afastamento", "incapacidade"].includes(d.certificateType)) {
      parts.push(`Período: ${isoToBR(d.startDate)} a ${isoToBR(d.endDate)}. Dias: ${d.daysOfAbsence ?? 1}.`);
      if (d.restrictedActivities) parts.push(`Restrições: ${d.restrictedActivities}.`);
      if (d.requiresRest) parts.push(`Repouso obrigatório.`);
      if (d.isPaid) parts.push(`Repouso remunerado.`);
    } else if (d.restrictedActivities) {
      parts.push(`Restrições: ${d.restrictedActivities}.`);
    }
    if (d.observations) parts.push(`Observações: ${d.observations}.`);
    return parts.join(" ");
  };

  const handleSave = async () => {
    if (!form.patientName?.trim() || !form.professionalName?.trim() || !form.reason?.trim()) {
      alert("Selecione paciente e profissional, e preencha Motivo/Descrição.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const payload: any = {
        owner_id: uid,
        patient_id: patientId || null,
        professional_id: professionalId || null,
        title: buildDbTitle(form),
        description: buildDbDescription(form),
        issued_at: form.issueDate ? new Date(form.issueDate).toISOString() : new Date().toISOString(),
        duration: buildDbDuration(form),
        signature_url: null,
        pdf_url: null,
        notes: form.observations || null,
      };

      const { data, error } = await supabase.from("certificates").insert(payload).select("id").single();
      if (error) throw error;

      const newId = data?.id as string;
      setHistory((prev) => [{ id: newId, createdAt: new Date().toLocaleDateString("pt-BR"), ...form }, ...prev]);
      onCreated?.(newId);
      alert("Atestado salvo com sucesso!");
    } catch (err: any) {
      console.warn("Erro ao salvar atestado:", err);
      alert(err?.message || "Não foi possível salvar o atestado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .certificate-container { box-shadow: none; margin: 0; padding: 0; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 flex items-center gap-3 p-3 border-b bg-white/80 backdrop-blur">
        <button
          onClick={handleHeaderBack}
          className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition"
          title="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Gerador de Atestados</h1>

       
      </div>

      {/* Tabs */}
      <div className="no-print flex gap-4 px-4 pt-3 border-b bg-white">
        {(["form", "preview", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t === "form" ? "Novo Atestado" : t === "preview" ? "Visualizar" : `Histórico (${history.length})`}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="p-4 overflow-y-auto flex-1 pb-28 sm:pb-20 lg:pb-10">
        {/* FORM */}
        {activeTab === "form" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tipo */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Tipo de Atestado</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(["saude", "comparecimento", "afastamento", "aptidao", "incapacidade"] as CertificateType[]).map((key) => (
                    <label key={key} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="certificateType"
                        value={key}
                        checked={form.certificateType === key}
                        onChange={(e) => setForm((prev) => ({ ...prev, certificateType: e.target.value as CertificateType }))}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {key === "saude" ? "Atestado de Saúde" :
                           key === "comparecimento" ? "Atestado de Comparecimento" :
                           key === "afastamento" ? "Atestado de Afastamento" :
                           key === "aptidao" ? "Atestado de Aptidão" : "Atestado de Incapacidade"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Paciente */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dados do Paciente</h2>

                {!patientId && (
                  <AsyncSearchSelect
                    label="Buscar paciente por nome/CPF/celular"
                    placeholder="Digite para buscar…"
                    onSearch={searchPatientsSupabase}
                    onSelect={(opt) => {
                      const p = opt.raw as any;
                      setPatientId(p.id);
                      setForm((prev) => ({
                        ...prev,
                        patientName: p.name || "",
                        patientCPF: p.cpf || "",
                        patientPhone: p.phone || "",
                        patientBirthISO: p.birth_date || "",
                      }));
                    }}
                  />
                )}

                {patientId && (
                  <SummaryCard
                    title="Paciente selecionado"
                    onChange={() => {
                      setPatientId("");
                      setForm((prev) => ({
                        ...prev,
                        patientName: "",
                        patientCPF: "",
                        patientPhone: "",
                        patientBirthISO: "",
                      }));
                    }}
                  >
                    <SummaryRow label="Nome" value={form.patientName} />
                    <SummaryRow label="CPF" value={formatCPF(form.patientCPF)} />
                    <SummaryRow label="Telefone" value={formatPhoneBR(form.patientPhone)} />
                    <SummaryRow label="Nascimento" value={isoToBR(form.patientBirthISO)} />
                  </SummaryCard>
                )}
              </div>

              {/* Profissional */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dados do Profissional</h2>

                {!professionalId && (
                  <AsyncSearchSelect
                    label="Buscar profissional por nome/Registro/celular"
                    placeholder="Digite para buscar…"
                    onSearch={searchProfessionalsSupabase}
                    onSelect={(opt) => {
                      const p = opt.raw as any;
                      setProfessionalId(p.id);
                      setForm((prev) => ({
                        ...prev,
                        professionalName: p.name || "",
                        professionalSpecialty: p.specialty || "",
                        professionalCRM: p.registration_code || "",
                      }));
                    }}
                  />
                )}

                {professionalId && (
                  <SummaryCard
                    title="Profissional selecionado"
                    onChange={() => {
                      setProfessionalId("");
                      setForm((prev) => ({
                        ...prev,
                        professionalName: "",
                        professionalSpecialty: "",
                        professionalCRM: "",
                      }));
                    }}
                  >
                    <SummaryRow label="Nome" value={form.professionalName} />
                    <SummaryRow label="Especialidade" value={form.professionalSpecialty} />
                    <SummaryRow label="Registro" value={form.professionalCRM} />
                  </SummaryCard>
                )}
              </div>

              {/* Atestado */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Dados do Atestado</h2>

                <div className="space-y-4">
                  <TextArea
                    label="Motivo/Descrição *"
                    rows={3}
                    value={form.reason}
                    onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Ex: Consulta médica"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field
                      label="Data Início"
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((prev) => {
                          const startDate = e.target.value;
                          const days = daysBetweenInclusive(startDate, prev.endDate);
                          return { ...prev, startDate, daysOfAbsence: days ?? prev.daysOfAbsence };
                        })
                      }
                    />
                    <Field
                      label="Data Fim"
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((prev) => {
                          const endDate = e.target.value;
                          const days = daysBetweenInclusive(prev.startDate, endDate);
                          return { ...prev, endDate, daysOfAbsence: days ?? prev.daysOfAbsence };
                        })
                      }
                    />
                    <Field
                      label="Dias de Ausência"
                      type="number"
                      min={1}
                      value={String(form.daysOfAbsence ?? 1)}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          daysOfAbsence: Math.max(1, parseInt(e.target.value || "1", 10)),
                        }))
                      }
                    />
                  </div>

                  <Field
                    label="Atividades Restritas"
                    value={form.restrictedActivities}
                    onChange={(e) => setForm((prev) => ({ ...prev, restrictedActivities: e.target.value }))}
                    placeholder="Ex: Trabalho pesado, Dirigir, Levantamento de peso..."
                  />

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.requiresRest}
                        onChange={(e) => setForm((prev) => ({ ...prev, requiresRest: e.target.checked }))}
                      />
                      <span className="text-sm font-medium text-gray-700">Repouso obrigatório</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.isPaid}
                        onChange={(e) => setForm((prev) => ({ ...prev, isPaid: e.target.checked }))}
                      />
                      <span className="text-sm font-medium text-gray-700">Repouso remunerado</span>
                    </label>
                  </div>

                  <TextArea
                    label="Observações Adicionais"
                    rows={3}
                    value={form.observations}
                    onChange={(e) => setForm((prev) => ({ ...prev, observations: e.target.value }))}
                    placeholder="Paciente apresenta melhora clínica satisfatória. Recomenda-se repouso relativo."
                  />

                  <Field
                    label="Data da Emissão"
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4">Ações</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Eye className="w-4 h-4" /> Visualizar
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    <Download className="w-4 h-4" /> Baixar PDF
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                  >
                    <Printer className="w-4 h-4" /> Imprimir
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 font-medium disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>

                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-semibold text-blue-900 text-sm mb-1">Dicas</p>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• Selecione paciente e profissional pela busca</li>
                        <li>• Verifique os dados antes de imprimir</li>
                        <li>• Guarde cópia para seus registros</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="no-print flex gap-3 mb-6">
              <button
                onClick={() => setActiveTab("form")}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 font-medium"
              >
                Voltar
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 font-medium"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                <Download className="w-4 h-4" /> Baixar PDF
              </button>
            </div>

            <div ref={printRef} className="pb-8">
              <CertificatePreview data={form} />
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Histórico de Atestados</h2>
            {history.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum atestado salvo ainda.</div>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="bg-white rounded-lg border p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-900">{h.patientName}</div>
                        <div className="text-xs text-gray-500">
                          Criado em: {h.createdAt} | Tipo: {h.certificateType}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setForm(h);
                            setActiveTab("preview");
                          }}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Visualizar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
