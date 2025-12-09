// src/pages/CertificateNew.tsx
import React, { useEffect, useRef, useState,} from "react";
import { ArrowLeft, Download, Printer, Plus, AlertCircle, Eye } from "lucide-react";
import { supabase } from "../lib/supabase";
import CertificatePreview from "../components/Certificates/CertificatePreview";
import { useConfirm } from "../providers/ConfirmProvider";
import { useToast } from "../components/ui/Toast";



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

  // Logo da clínica (novo)
clinicLogoUrl?: string | null;

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

type SavedRow = CertificateFormData & {
  id: string;
  createdAt: string;
  createdAtTs: number;
  patientId?: string;
  professionalId?: string;
};

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

// Title Case que preserva o espaço final (igual ao Profile)
const capSingle = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "");
const titleAllWordsLive = (s: string) => {
  const orig = s || "";
  const hasTrailingSpace = /\s$/.test(orig);
  const normalized = orig
    .toLowerCase()
    .replace(/\s{2,}/g, " ")
    .trimStart()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.includes("-") ? w.split("-").map(capSingle).join("-") : capSingle(w)))
    .join(" ");
  return hasTrailingSpace ? normalized + " " : normalized;
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
  const DEBOUNCE_MS = 500; // menos chamadas
  const debounced = useDebouncedValue(q, DEBOUNCE_MS);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AsyncOption<T>[]>([]);

  // Input: preserva espaço, mascara apenas quando completo, title case para texto
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    const digits = val.replace(/\D+/g, "");
    if (digits && /^\d+$/.test(digits)) {
      if (digits.length === 11) {
        val = formatCPF(digits);
      } else if (digits.length === 10 || digits.length === 11) {
        val = formatPhoneBR(digits);
      }
    } else {
      val = titleAllWordsLive(val);
    }
    setQ(val);
  };

  useEffect(() => {
    let canceled = false;
    (async () => {
      const query = debounced.trim();
      if (query.length < 2) {
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
          onChange={handleInput}
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

// Busca profissionais por nome, registro, telefone OU CPF (somente ativos e não arquivados)
async function searchProfessionalsSupabase(q: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;

  let query = supabase
    .from("professionals")
    .select("id, name, specialty, registration_code, phone, cpf")
    .limit(50)
    .order("name", { ascending: true })
    .is("deleted_at", null) // não arquivados
    .eq("is_active", true); // apenas ativos

  if (uid) query = query.eq("owner_id", uid);

  const digits = (q || "").replace(/\D+/g, "");

  const parts: string[] = [`name.ilike.%${q}%`];
  if (digits) {
    parts.push(
      `registration_code.ilike.%${digits}%`,
      `phone.ilike.%${digits}%`,
      `cpf.ilike.%${digits}%`
    );
  }

  query = query.or(parts.join(","));

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
          {p.cpf ? ` • ${p.cpf}` : ""}
          {p.registration_code ? ` • ${p.registration_code}` : ""}
          {p.phone ? ` • ${formatPhoneBR(p.phone)}` : ""}
        </span>
      </div>
    ),
    raw: p,
  }));
}

/* ============================================================
   Campos controlados
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
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"form" | "preview" | "history">("form");
  const printRef = useRef<HTMLDivElement | null>(null);
 const toast = useToast();




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
    restrictedActivities: initialData?.restrictedActivities || "",
    includeSignature: initialData?.includeSignature ?? true,
    includeQRCode: initialData?.includeQRCode ?? false,
    clinicLogoUrl: null,
  }));

  const [history, setHistory] = useState<SavedRow[]>([]);
  const [savedCertificateId, setSavedCertificateId] = useState<string | null>(null);
  // 🔍 filtros e paginação
const [search, setSearch] = useState("");
const [dateRange, setDateRange] = useState("all");
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [page, setPage] = useState(1);
const itemsPerPage = 10;



  // Carrega html2pdf
  useEffect(() => {
    if ((window as any).html2pdf) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // Carregar nome, CNPJ e LOGO da clínica
useEffect(() => {
  let cancelled = false;

  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) return;

    const { data: prof, error } = await supabase
      .from("profiles")
      .select("clinic_name, clinic_cnpj, clinic_logo_path")
      .eq("id", userId)
      .maybeSingle();

    if (error || !prof) return;

    let logoUrl: string | null = null;

    if (prof.clinic_logo_path) {
      const { data } = supabase.storage
        .from("clinic-logos")
        .getPublicUrl(prof.clinic_logo_path);

      logoUrl = data?.publicUrl ?? null;
    }

    if (!cancelled) {
      setForm((prev) => ({
        ...prev,
        clinicName: prev.clinicName || prof.clinic_name || "",
        clinicCNPJ: prev.clinicCNPJ || prof.clinic_cnpj || "",
        clinicLogoUrl: logoUrl,
      }));
    }
  })();

  return () => { cancelled = true; };
}, []);


useEffect(() => {
  if (activeTab !== "history") return;

  (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from("certificates")
      .select("id, created_at, data_json")
      .eq("owner_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
     setHistory(
  data.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toLocaleDateString("pt-BR"),
    createdAtTs: new Date(row.created_at).getTime(), // 👈 ESTE NOME PRECISA SER EXATO
    ...row.data_json,
  }))
);

    }
  })();
}, [activeTab]);


  // ===== Ações de impressão / PDF =====
const handlePrint = async () => {
  // ⛔ valida antes de abrir modal
  if (!form.patientName?.trim() || !form.professionalName?.trim()) {
    toast.error("Selecione paciente e profissional antes de imprimir.");
    return;
  }

  const ok = await confirm({
    title: "Imprimir Atestado?",
    description: (
      <>
        Ao confirmar, este atestado será <strong>salvo automaticamente</strong> no sistema
        <br />
        e, em seguida, a impressão será iniciada.
      </>
    ),
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "primary",
  });

  if (!ok) return;

  // 1. salvar primeiro
  const savedId = await handleSave();
  if (!savedId) return;

  // 2. garantir preview visível antes de printar
  if (activeTab !== "preview") {
    setActiveTab("preview");
    setTimeout(() => window.print(), 150);
    return;
  }

  window.print();
};

const saveCertificateToHistory = (id: string) => {
  setHistory((prev) => [
    {
      id,
      createdAt: new Date().toLocaleDateString("pt-BR"),
      createdAtTs: Date.now(),
      patientId,
      professionalId,
      ...form,
    },
    ...prev,
  ]);
};

 const handleDownloadPDF = async () => {
  // ⛔ valida antes de abrir modal
  if (!form.patientName?.trim() || !form.professionalName?.trim()) {
    toast.error("Selecione paciente e profissional antes de gerar PDF.");
    return;
  }

  const ok = await confirm({
    title: "Gerar PDF do Atestado?",
    description: (
      <>
        Ao confirmar, este atestado será <strong>salvo automaticamente</strong> no sistema
        <br />
        e o arquivo PDF será baixado.
      </>
    ),
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "primary",
  });

  if (!ok) return;

  const savedId = await handleSave();
  if (!savedId) return;

  const w = window as any;
  if (!printRef.current || !w.html2pdf) {
    toast.error("Abra a visualização antes de gerar PDF.");
    return;
  }

  w.html2pdf()
    .set({
      margin: 10,
      filename: `Atestado_${(form.patientName || "Paciente").replace(/\s+/g, "_")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(printRef.current)
    .save();
};

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
  const buildDbDescription = (d: CertificateFormData) => {
    const parts: string[] = [];
    parts.push(`Motivo: ${d.reason}.`);
    parts.push(`Emitido em: ${isoToBR(d.issueDate)}.`);
    if (["afastamento", "incapacidade"].includes(d.certificateType)) {
      parts.push(
        `Período: ${isoToBR(d.startDate)} a ${isoToBR(d.endDate)}. Dias: ${d.daysOfAbsence ?? 1}.`
      );
      if (d.restrictedActivities) parts.push(`Restrições: ${d.restrictedActivities}.`);
    } else if (d.restrictedActivities) {
      parts.push(`Restrições: ${d.restrictedActivities}.`);
    }
    if (d.observations) parts.push(`Observações: ${d.observations}.`);
    return parts.join(" ");
  };

    const handleSave = async (): Promise<string | null> => {
    if (!form.patientName?.trim() || !form.professionalName?.trim() || !form.reason?.trim()) {
     toast.error("Selecione paciente e profissional, e preencha Motivo/Descrição.");
      return null;
    }

    // ============================================================
// ⚠️ GERA PDF E SALVA NO STORAGE + DB
// ============================================================
const generateAndUploadPDF = async (certId: string) => {
  const w = window as any;
  if (!printRef.current || !w.html2pdf) return;

  // 1. GERAR PDF COMO BLOB
  const pdfBlob = await w.html2pdf()
    .set({
      margin: 10,
      filename: `Atestado_${(form.patientName || "Paciente").replace(/\s+/g, "_")}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(printRef.current)
    .outputPdf("blob");

  // 2. UPLOAD NO STORAGE
  const storagePath = `certificates/${certId}.pdf`;
  await supabase.storage.from("certificates").upload(storagePath, pdfBlob, {
    contentType: "application/pdf",
    upsert: true,
  });

  // 3. PUBLIC URL
  const { data } = supabase.storage.from("certificates").getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;

  // 4. ATUALIZA CERTIFICADO
  await supabase.from("certificates")
    .update({ pdf_url: publicUrl })
    .eq("id", certId);
};

    
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

 const payload = {
  owner_id: uid,
  patient_id: patientId || null,
  professional_id: professionalId || null,

  title: buildDbTitle(form),
  description: buildDbDescription(form),

  // Datas
  issue_date: new Date(form.issueDate).toISOString(),
  start_date: form.startDate || null,
  end_date: form.endDate || null,

  // Motivo / descrição resumida
  reason_text: form.reason,

  // Data json completa do atestado (opcional mas recomendado)
  data_json: form,


  // PDF vai ser salvo depois
  pdf_url: null,

  created_at: new Date().toISOString(),
};

      const { data, error } = await supabase.from("certificates").insert(payload).select("id").single();
      if (error) throw error;

      const newId = data?.id as string;
setSavedCertificateId(newId);
saveCertificateToHistory(newId);

// ⚠️ GERAR E SUBIR PDF AGORA
await generateAndUploadPDF(newId);

// depois volta para histórico
setActiveTab("history");

return newId;

    } catch (err: any) {
      console.warn("Erro ao salvar atestado:", err);
toast.error(err?.message || "Não foi possível salvar o atestado.");

    } finally {
      
    }
    return null;
  };

// =======================================
// 🔎 FILTRAGEM + PAGINAÇÃO
// =======================================
const filtered = history.filter((h) => {
  if (search && !h.patientName.toLowerCase().includes(search.toLowerCase()))
    return false;

  if (dateRange === "7") return h.createdAtTs >= Date.now() - 7 * 86400000;
  if (dateRange === "30") return h.createdAtTs >= Date.now() - 30 * 86400000;

  if (dateRange === "custom" && startDate && endDate) {
    return (
      h.createdAtTs >= new Date(startDate).getTime() &&
      h.createdAtTs <= new Date(endDate).getTime()
    );
  }

  return true;
});


const totalPages = Math.ceil(filtered.length / itemsPerPage);
const pagedHistory = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="flex flex-col h-full">
      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }

          /* Esconde tudo... */
          body * {
            visibility: hidden;
          }

          /* ...menos o conteúdo do atestado */
          #print-area, #print-area * {
            visibility: visible;
          }

          #print-area {
            position: absolute;
            inset: 0;
            margin: 0;
          }

          .certificate-container {
            box-shadow: none;
            margin: 0;
            padding: 0;
          }

          @page { margin: 15mm; size: A4; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur px-3 py-3 no-print">
        <div className="relative flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar
          </button>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-base sm:text-lg font-semibold text-slate-900 whitespace-nowrap">
            Gerador de Atestados
          </h1>
        </div>
      </div>

            {/* Tabs */}
      <div className="no-print flex gap-4 px-4 pt-3 border-b bg-white">
        <button
  onClick={() => {
    setActiveTab("form");

    // limpa estado de atestado salvo
    setSavedCertificateId(null);

    // limpa seleção
    setPatientId("");
    setProfessionalId("");

    // reseta o form, mantendo os dados fixos da clínica
    setForm((prev) => ({
      patientName: "",
      patientCPF: "",
      patientPhone: "",
      patientBirthISO: "",
      professionalName: "",
      professionalSpecialty: "",
      professionalCRM: "",
      clinicName: prev.clinicName,       // mantém
      clinicCNPJ: prev.clinicCNPJ,       // mantém
      clinicLogoUrl: prev.clinicLogoUrl, // mantém
      certificateType: "saude",
      reason: "Consulta médica",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      daysOfAbsence: 1,
      observations: "",
      issueDate: new Date().toISOString().slice(0, 10),
      restrictedActivities: "",
      includeSignature: true,
      includeQRCode: false,
    }));
  }}

          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "form"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Novo Atestado
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Histórico ({history.length})
        </button>
      </div>


      {/* Conteúdo */}
<div className="p-4 overflow-y-auto flex-1 pb-[85px] sm:pb-[95px] lg:pb-[110px]">        {/* FORM */}
        {activeTab === "form" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tipo */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Tipo de Atestado</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(
                    ["saude", "comparecimento", "afastamento", "aptidao", "incapacidade"] as CertificateType[]
                  ).map((key) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="certificateType"
                        value={key}
                        checked={form.certificateType === key}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            certificateType: e.target.value as CertificateType,
                          }))
                        }
                        className="mt-1"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {key === "saude"
                            ? "Atestado de Saúde"
                            : key === "comparecimento"
                            ? "Atestado de Comparecimento"
                            : key === "afastamento"
                            ? "Atestado de Afastamento"
                            : key === "aptidao"
                            ? "Atestado de Aptidão"
                            : "Atestado de Incapacidade"}
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
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
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
                          return {
                            ...prev,
                            startDate,
                            daysOfAbsence: days ?? prev.daysOfAbsence,
                          };
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
                          return {
                            ...prev,
                            endDate,
                            daysOfAbsence: days ?? prev.daysOfAbsence,
                          };
                        })
                      }
                    />
                    <Field
  label="Dias de Ausência"
  type="number"
  min={1}
  value={String(form.daysOfAbsence ?? 1)}
  onChange={(e) => {
    const val = Math.max(1, parseInt(e.target.value || "1", 10));
    const start = form.startDate ? new Date(form.startDate + "T00:00:00") : null;

    let newEnd = form.endDate;

    // SE existe data de início, calcula automaticamente data fim
    if (start && !isNaN(start.getTime())) {
      const calc = new Date(start);
      calc.setDate(calc.getDate() + (val - 1)); // diferença inclusiva
      newEnd = calc.toISOString().slice(0, 10);
    }

    setForm((prev) => ({
      ...prev,
      daysOfAbsence: val,
      endDate: newEnd,
    }));
  }}
/>

                  </div>

                  <Field
                    label="Atividades Restritas"
                    value={form.restrictedActivities}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        restrictedActivities: e.target.value,
                      }))
                    }
                    placeholder="Ex: Trabalho pesado, Dirigir, Levantamento de peso..."
                  />

                  <TextArea
                    label="Observações Adicionais"
                    rows={3}
                    value={form.observations}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        observations: e.target.value,
                      }))
                    }
                    placeholder="Paciente apresenta melhora clínica satisfatória. Recomenda-se repouso relativo."
                  />

                  <Field
                    label="Data da Emissão"
                    type="date"
                    value={form.issueDate}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        issueDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-24 no-print">
                <h3 className="font-bold text-gray-900 mb-4">Ações</h3>
                                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab("preview")}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4" /> Gerar Atestado
                  </button>
                </div>


                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertCircle
                      className="text-blue-600 flex-shrink-0 mt-0.5"
                      size={20}
                    />
                    <div>
                      <p className="font-semibold text-blue-900 text-sm mb-1">Dicas</p>
                      <ul className="text-xs text-blue-800 space-y-1">
                        <li>• Selecione paciente e profissional pela busca</li>
                        <li>• Verifique os dados antes de imprimir</li>
                        <li>• A cópia será gerada automaticamente para seus registros</li>
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
    onClick={() => setActiveTab("history")}
    className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 font-medium"
  >
    Voltar
  </button>

  {/* Só mostra imprimir/baixar se o atestado AINDA NÃO FOI SALVO */}
  {!savedCertificateId && (

    <>
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
    </>
  )}
</div>


            <div
              ref={printRef}
              id="print-area"
              className="pb-8 certificate-container"
            >
              <CertificatePreview data={form} />
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
  <div className="space-y-4">
    <h2 className="text-xl font-bold text-gray-900">Histórico de Atestados</h2>

    {/* 🔍 Busca + Filtro */}
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Buscar paciente..."
        value={search}
        onChange={(e) => {
          setPage(1); 
          setSearch(e.target.value);
        }}
        className="w-full sm:w-64 px-3 py-2 border rounded-lg text-sm"
      />

      <select
        value={dateRange}
        onChange={(e) => {
          setPage(1);
          setDateRange(e.target.value);
        }}
        className="px-3 py-2 border rounded-lg text-sm"
      >
        <option value="all">Todos</option>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="custom">Personalizado…</option>
      </select>
    </div>

    {dateRange === "custom" && (
      <div className="flex gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />
      </div>
    )}

    {pagedHistory.length === 0 ? (
      <div className="text-sm text-gray-500">Nenhum atestado encontrado.</div>
    ) : (
      <div className="space-y-3">
        {pagedHistory.map((h) => (
          <div key={h.id} className="bg-white rounded-lg border p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-gray-900">{h.patientName}</div>
                <div className="text-xs text-gray-500">
                  Criado em: {h.createdAt} | Tipo: {h.certificateType}
                </div>
              </div>

              <button
  onClick={() =>
    window.dispatchEvent(
      new CustomEvent("certificate:view", { detail: { id: h.id } })
    )
  }
  title="Visualizar documento"
  className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700"
>
  <Eye className="w-5 h-5" />
</button>

            </div>
          </div>
        ))}
      </div>
    )}

    {/* ▶ PAGINAÇÃO */}
    {totalPages > 1 && (
      <div className="flex justify-between items-center pt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          ← Anterior
        </button>

        <span className="text-sm text-gray-600">
          Página {page} de {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Próxima →
        </button>
      </div>
    )}
  </div>
)}

      </div>
    </div>
  );
}
