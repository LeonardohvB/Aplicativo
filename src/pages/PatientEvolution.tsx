// src/pages/PatientEvolution.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  UploadCloud,
  FileText,
  BarChart2,
  Search,
  Phone,
  Mail,
  Download,
} from "lucide-react";
import { useEvolutionFiles } from "../hooks/useEvolutionFiles";
import PatientEvolutionTimeline from "../components/Patients/PatientEvolutionTimeline";
import LiveEncounter from "./LiveEncounter";
import PDFMedicalReport, {
  PDFClinic,
  PDFConsultation,
  PDFPatient,
} from "../components/Patients/PDFMedicalReport";

/* =============== helpers =============== */
const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

const maskCell = (v?: string | null) => {
  const d = onlyDigits(v || "").slice(0, 11);
  if (!d) return "";
  const dd = d.padEnd(11, " ");
  return `(${dd.slice(0, 2)}) ${dd.slice(2, 3)} ${dd.slice(3, 7)}-${dd.slice(7, 11).trim()}`;
};

const maskCPF = (v?: string | null) => {
  const d = onlyDigits(v || "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const initials = (name?: string | null) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

// Calcula idade a partir de birth_date no formato ISO "YYYY-MM-DD"
const ageFromISO = (iso?: string | null): number | null => {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const yyyy = +m[1],
    mm = +m[2],
    dd = +m[3];

  const today = new Date();
  let age = today.getFullYear() - yyyy;

  const month = today.getMonth() + 1; // 1..12
  const day = today.getDate();
  if (month < mm || (month === mm && day < dd)) age--;

  return age >= 0 ? age : null;
};

// Formata "YYYY-MM-DD" para "DD/MM/YYYY"
const formatDateBR = (iso?: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

/* =============== types =============== */
type Patient = {
  id: string;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  birth_date: string | null;
  email: string | null;
};

type TabKey = "timeline" | "metrics" | "documents";

/* ============== UI subcomponent ============== */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-1 pb-2 -mb-px inline-flex items-center gap-2 text-sm whitespace-nowrap",
        active ? "text-blue-700 border-b-2 border-blue-600" : "text-gray-700 hover:text-gray-900",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

/* ===================================== */

export default function PatientEvolution({ onBack }: { onBack: () => void }) {
  /* ---------- busca ---------- */
  const [q, setQ] = useState("");
  const [showSug, setShowSug] = useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const sugBoxRef = useRef<HTMLDivElement>(null);

  /* ---------- paciente ---------- */
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---------- métricas derivadas ---------- */
  const [totalConsults, setTotalConsults] = useState<number | null>(null);
  const [lastConsult, setLastConsult] = useState<string | null>(null);

  /* ---------- abas ---------- */
  const [tab, setTab] = useState<TabKey>("timeline");

  /* ---------- refresh da timeline após finalizar atendimento ---------- */
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    const bump = () => setRefreshTick((x) => x + 1);
    window.addEventListener("encounter:close", bump as EventListener);
    window.addEventListener("timeline:refresh", bump as EventListener);
    return () => {
      window.removeEventListener("encounter:close", bump as EventListener);
      window.removeEventListener("timeline:refresh", bump as EventListener);
    };
  }, []);

  /* ---------- arquivos da evolução (placeholder geral) ---------- */
  const evolutionId = undefined;
  const { files, uploadFile, removeFile, loading: loadingFiles } = useEvolutionFiles(evolutionId);

  /* ===== overlay do LiveEncounter ===== */
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveInitial, setLiveInitial] = useState<any | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<any>)?.detail || {};
      setLiveInitial({
        appointmentId: d.appointmentId ?? "",
        patientName: d.patientName ?? (patient?.name || "Paciente"),
        professionalName: d.professionalName ?? "Profissional",
        serviceName: d.serviceName ?? "Consulta",
        encounterId: d.encounterId,
      });
      setLiveOpen(true);
    };

    const onClose = () => setLiveOpen(false);

    window.addEventListener("encounter:open", onOpen as EventListener);
    window.addEventListener("encounter:close", onClose as EventListener);
    return () => {
      window.removeEventListener("encounter:open", onOpen as EventListener);
      window.removeEventListener("encounter:close", onClose as EventListener);
    };
  }, [patient?.name]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (liveOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [liveOpen]);

  /* ===== fechar sugestões ao clicar fora / ESC ===== */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!showSug) return;
      const t = e.target as Node;
      if (!inputRef.current?.contains(t) && !sugBoxRef.current?.contains(t)) {
        setShowSug(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSug(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSug]);

  /* ===== buscar pacientes ao digitar ===== */
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const term = q.trim();
      if (!term) {
        if (alive) setSuggestions([]);
        return;
      }

      setLoadingSug(true);
      try {
        const dig = onlyDigits(term);

        const ors: string[] = [];
        if (!dig) {
          ors.push(`name.ilike.%${term}%`);
        } else {
          ors.push(`cpf.ilike.%${dig}%`);
          ors.push(`phone.ilike.%${dig}%`);
        }

        const { data, error } = await supabase
          .from("patients")
          .select("id, name, cpf, phone, birth_date, email")
          .or(ors.join(","))
          .order("name", { ascending: true })
          .limit(10);

        if (!alive) return;

        if (error) {
          console.warn("patient search error:", error);
          setSuggestions([]);
        } else {
          setSuggestions((data || []) as Patient[]);
        }
      } finally {
        if (alive) setLoadingSug(false);
      }
    };

    const t = setTimeout(run, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  /* ===== carregar paciente por id ===== */
  const loadPatientById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, cpf, phone, birth_date, email")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      setPatient((data || null) as Patient | null);
      setTab("timeline");
      setRefreshTick((x) => x + 1);
      setShowSug(false);
    } catch (e) {
      console.warn("loadPatientById error:", e);
      setPatient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ===== puxar Total de consultas e Última consulta ===== */
  useEffect(() => {
    let alive = true;

    const fetchFromEvolutionTable = async (pid: string) => {
      const { count, error: cErr } = await supabase
        .from("patient_evolution")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", pid);
      if (cErr) throw cErr;

      const { data: lastRow, error: lErr } = await supabase
        .from("patient_evolution")
        .select("occurred_at")
        .eq("patient_id", pid)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lErr) throw lErr;

      return {
        total: typeof count === "number" ? count : null,
        last: (lastRow as any)?.occurred_at
          ? formatDateBR(String((lastRow as any).occurred_at).slice(0, 10))
          : null,
      };
    };

    const fetchFromEvolutionView = async (pid: string) => {
      const { count, error: cErr } = await supabase
        .from("patient_evolution_feed")
        .select("note_id", { count: "exact", head: true })
        .eq("patient_id", pid);
      if (cErr) throw cErr;

      const { data: lastRow, error: lErr } = await supabase
        .from("patient_evolution_feed")
        .select("ts")
        .eq("patient_id", pid)
        .order("ts", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lErr) throw lErr;

      return {
        total: typeof count === "number" ? count : null,
        last: (lastRow as any)?.ts
          ? formatDateBR(String((lastRow as any).ts).slice(0, 10))
          : null,
      };
    };

    const fetchFromHistory = async (pid: string) => {
      const { count, error: countErr } = await supabase
        .from("appointment_history")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", pid);

      const { data: lastRow, error: lastErr } = await supabase
        .from("appointment_history")
        .select("date, start_time")
        .eq("patient_id", pid)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        total: countErr ? null : typeof count === "number" ? count : null,
        last: lastErr ? null : (lastRow as any)?.date ? formatDateBR((lastRow as any).date) : null,
      };
    };

    const run = async () => {
      if (!patient?.id) {
        setTotalConsults(null);
        setLastConsult(null);
        return;
      }
      try {
        const t = await fetchFromEvolutionTable(patient.id);
        if (t.total && t.total > 0) {
          if (!alive) return;
          setTotalConsults(t.total);
          setLastConsult(t.last);
          return;
        }

        const v = await fetchFromEvolutionView(patient.id);
        if (v.total && v.total > 0) {
          if (!alive) return;
          setTotalConsults(v.total);
          setLastConsult(v.last);
          return;
        }

        const h = await fetchFromHistory(patient.id);
        if (!alive) return;
        setTotalConsults(h.total);
        setLastConsult(h.last);
      } catch (err) {
        if (!alive) return;
        console.warn("stats fetch warn:", err);
        setTotalConsults(null);
        setLastConsult(null);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [patient?.id]);

  /* ===== derivados do header ===== */
  const displayName = useMemo(() => patient?.name || "", [patient]);
  const displayCPF = useMemo(() => maskCPF(patient?.cpf), [patient]);
  const displayPhone = useMemo(() => maskCell(patient?.phone), [patient]);
  const displayEmail = useMemo(() => patient?.email || "", [patient]);
  const displayAge = useMemo(() => ageFromISO(patient?.birth_date), [patient]);

  /* ====== PDF: estados ====== */
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfConsults, setPdfConsults] = useState<PDFConsultation[]>([]);
  const [pdfClinic, setPdfClinic] = useState<PDFClinic | null>(null);

  // Carrega CONSULTAS de patient_evolution
  const loadPdfData = useCallback(async () => {
    if (!patient?.id) return;

    const { data, error } = await supabase
      .from("patient_evolution")
      .select(
        "id, occurred_at, professional_name, specialty, title, symptoms, diagnosis, conduct, observations, data_json, vitals, medications, s_text, o_text, a_text, p_text"
      )
      .eq("patient_id", patient.id)
      .order("occurred_at", { ascending: false });

    if (error) {
      console.warn("pdf load error:", error);
      setPdfConsults([]);
      return;
    }

    const items = (data || []).map((row: any): PDFConsultation => {
      const dj = row.data_json || {};
      const v = row.vitals || dj.vitals || {};
      // Observações reais (sem repetir S/O):
      const rawObs = String(row.observations ?? dj.observations ?? "").trim();

      return {
        id: row.id,
        occurred_at: row.occurred_at, // ISO UTC do banco
        professional: row.professional_name || "Profissional",
        specialty: row.specialty || null,
        type: row.title || "Consulta",
        symptoms: row.symptoms || dj.tags || [],
        diagnosis: row.diagnosis || [],
        conduct: row.conduct ?? null,
        observations: rawObs || null,
        S: dj.S || row.s_text || "",
        O: dj.O || row.o_text || "",
        A: dj.A || row.a_text || (row.diagnosis || []).join("\n"),
        P: dj.P || row.p_text || row.conduct || "",
        vitals: {
          pressure: v.bp,
          heartRate: v.hr,
          temperature: v.temp,
          weight: v.weight,
          height: v.height,
        },
        medications: row.medications || dj.medications || [],
      };
    });

    setPdfConsults(items);
  }, [patient?.id]);

  // Carrega CLÍNICA a partir de profiles do usuário logado
  const loadPdfClinic = useCallback(async () => {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    setPdfClinic(null);
    return;
  }

  const { data: prof, error } = await supabase
    .from("profiles")
    .select("clinic_name, clinic_cnpj, clinic_address, clinic_phone, clinic_email, clinic_logo_path")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("profile load error:", error);
    setPdfClinic(null);
    return;
  }

  let logoUrl: string | null = null;
  if (prof?.clinic_logo_path) {
    const { data } = supabase.storage
      .from("clinic-logos") // seu bucket
      .getPublicUrl(prof.clinic_logo_path);

    logoUrl = data?.publicUrl ?? null;
  }

  const clinic: PDFClinic = {
    name: prof?.clinic_name || "—",
    cnpj: prof?.clinic_cnpj || "—",
    address: prof?.clinic_address || "—",
    phone: prof?.clinic_phone || "—",
    email: prof?.clinic_email || "—",
    shortId: (prof?.clinic_name || "SI").slice(0, 2).toUpperCase(),
    city: "",
    logoUrl,           // 👈 AQUI VAI A LOGO
  };

  setPdfClinic(clinic);
}, []);


  // Abrir modal já carregando tudo
  const openPdfModal = useCallback(async () => {
    await Promise.all([loadPdfData(), loadPdfClinic()]);
    setPdfOpen(true);
  }, [loadPdfData, loadPdfClinic]);

  // 🔵 Listener do PDF individual (corrigido)
useEffect(() => {
  const handleSingle = async (e: Event) => {
    const detail = (e as CustomEvent<any>).detail;
    const raw = detail?.consultation;
    if (!raw) return;

    // ----- 🔥 Reconstruir objeto EXACTO do PDF geral -----
    const dj = raw.data_json || {};
    const v = raw.vitals || dj.vitals || {};

    const formatted: PDFConsultation = {
      id: raw.id,
      occurred_at: raw.occurred_at,

      // Nome do profissional
      professional: raw.professional_name || "Profissional",

      // Especialidade igual à timeline
      specialty:
        raw.professional_specialty ||
        raw.specialty ||
        raw.professional_role ||
        dj.specialty ||
        null,

      type: raw.title || "Consulta",

      symptoms: raw.symptoms || dj.tags || [],
      diagnosis: raw.diagnosis || [],

      conduct: raw.conduct ?? null,

      observations:
        raw.observations ??
        dj.observations ??
        null,

      S: dj.S || raw.s_text || "",
      O: dj.O || raw.o_text || "",
      A: dj.A || raw.a_text || "",
      P: dj.P || raw.p_text || raw.conduct || "",

      vitals: {
        pressure: v.bp || "",
        heartRate: v.hr || "",
        temperature: v.temp || "",
        weight: v.weight || "",
        height: v.height || "",
      },

      medications: raw.medications || dj.medications || [],
    };

  // ----- 🔵 Carregar dados da clínica -----
await loadPdfClinic();

// ----- 🔥 Contar consultas deste mesmo profissional -----
if (patient?.id) {
  const { data: allRows } = await supabase
    .from("patient_evolution")
    .select("professional_name")
    .eq("patient_id", patient.id);

  const professionalCount =
    allRows?.filter((r) => r.professional_name === formatted.professional).length || 1;

  setPdfClinic((prev) =>
    prev ? { ...prev, professionalCount } : { professionalCount }
  );
}

// ----- 🔵 Abrir apenas esse PDF -----
setPdfConsults([formatted]);
setPdfOpen(true);

  };

  window.addEventListener("open:pdf:single", handleSingle as EventListener);
  return () => {
    window.removeEventListener("open:pdf:single", handleSingle as EventListener);
  };
}, [loadPdfClinic]);


  /* ===== UI ===== */
  return (
    <div className="p-4 pb-24 bg-gray-50 min-h-screen">
      {/* topo */}
      <div className="relative flex items-center mb-6">
        <button onClick={onBack} className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-base sm:text-lg font-semibold text-slate-900 whitespace-nowrap">
  Evolução do Paciente
</h1>


       
      </div>

      {/* busca */}
      <div className="relative mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setShowSug(true)}
            placeholder="Buscar paciente por nome, CPF ou telefone…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* sugestões */}
        {showSug && q.trim() && (
          <div
            ref={sugBoxRef}
            className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            {loadingSug && <div className="px-3 py-2 text-sm text-gray-500">Carregando…</div>}

            {!loadingSug && suggestions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Nenhum paciente encontrado</div>
            )}

            {!loadingSug &&
              suggestions.map((p) => {
                const dn = p.name || "";
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setQ(dn);
                      setShowSug(false);
                      loadPatientById(p.id);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-800 truncate">{dn}</div>
                    <div className="text-xs text-gray-500">
                      {maskCPF(p.cpf)} • {maskCell(p.phone)}
                    </div>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* cabeçalho do paciente */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
        {loading ? (
          <div className="text-gray-500">Carregando paciente…</div>
        ) : !patient ? (
          <div className="text-gray-500">Paciente não encontrado.</div>
        ) : (
          <div className="flex items-start gap-3 md:gap-4">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
              {initials(displayName)}
            </div>

            {/* min-w-0 permite o texto encolher dentro do flex */}
            <div className="flex-1 min-w-0">
              <div className="text-base md:text-lg font-semibold text-gray-900 break-words">{displayName}</div>
              <div className="text-xs md:text-sm text-gray-500 break-words">CPF: {displayCPF || "—"}</div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Idade</div>
                  <div className="text-gray-900">{displayAge !== null ? `${displayAge} anos` : "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Total de consultas</div>
                  <div className="text-gray-900">{totalConsults !== null ? totalConsults : "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">Última consulta</div>
                  <div className="text-gray-900">{lastConsult || "—"}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
                <div className="inline-flex items-center gap-2 break-words">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {displayPhone || "—"}
                </div>
                <div className="inline-flex items-center gap-2 break-words">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {displayEmail || "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Abas (fora de “pílula”) */}
      <div className="mb-3 border-b border-gray-200">
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          <TabButton
            active={tab === "timeline"}
            onClick={() => setTab("timeline")}
            icon={<CalendarIcon className="w-4 h-4" />}
            label="Linha do Tempo"
          />
          <TabButton
            active={tab === "metrics"}
            onClick={() => setTab("metrics")}
            icon={<BarChart2 className="w-4 h-4" />}
            label="Métricas"
          />
          <TabButton
            active={tab === "documents"}
            onClick={() => setTab("documents")}
            icon={<FileText className="w-4 h-4" />}
            label="Documentos"
          />
        </div>
      </div>

       {/* Botão PDF à direita */}
      
  <div className="mb-3 flex justify-end">
    <button
      onClick={openPdfModal}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
      title="Gerar PDF do prontuário"
    >
      <Download className="w-4 h-4" />
      Baixar PDF
    </button>
  </div>


      {/* Conteúdo das abas */}
      {tab === "timeline" && (
        <div className="space-y-4 evo-wrap">
          {patient ? (
            <PatientEvolutionTimeline key={`${patient.id}:${refreshTick}`} patientId={patient.id} />
          ) : (
            <div className="text-sm text-gray-600">Selecione um paciente para ver a linha do tempo.</div>
          )}

          {/* Anexos gerais */}
          {patient && (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-800">Anexos da evolução</div>
                  <div className="text-xs text-gray-500">
                    {loadingFiles
                      ? "Carregando…"
                      : files.length === 0
                      ? "Nenhum arquivo anexado até o momento."
                      : `${files.length} arquivo(s)`}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  Enviar arquivo
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (!patient) {
                        alert("Selecione um paciente primeiro.");
                        return;
                      }
                      const res = await uploadFile(f);
                      if (!res) alert("Falha ao enviar arquivo.");
                    }}
                  />
                </label>
              </div>

              {files.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-800 break-words">{f.file_name}</span>
                      </div>
                      <button className="text-red-600 hover:underline" onClick={() => removeFile(f.id, f.file_path)}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "metrics" && (
        <div className="text-sm text-gray-600">Em breve: gráficos de sinais vitais, evolução de medidas, etc.</div>
      )}

      {tab === "documents" && (
        <div className="text-sm text-gray-600">Em breve: prescrições, relatórios e documentos gerados.</div>
      )}

      {/* Escopo CSS local para forçar quebra dentro da aba timeline */}
      <style>{`
        .evo-wrap, .evo-wrap * {
          overflow-wrap: anywhere;
          word-break: break-word;
          min-width: 0;
        }
      `}</style>

      {/* ===== Overlay do LiveEncounter ===== */}
      {liveOpen && (
        <div className="fixed inset-0 z-[100] bg-white">
          <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-3 sm:px-4 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-[101]">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("encounter:close"))}
              className="text-blue-600 hover:text-blue-700 font-medium"
              title="Fechar edição"
            >
              Fechar
            </button>
          </div>
          <div className="pt-12 h-full overflow-auto no-scrollbar">
            <LiveEncounter initialData={liveInitial || undefined} />
          </div>
        </div>
      )}

      {/* ===== Modal de Pré-visualização do PDF ===== */}
      {pdfOpen && patient && (
        <div
          className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setPdfOpen(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-[1120px] max-h-[95vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-3 py-2 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="font-semibold">Pré-visualização do PDF</div>
              <button className="text-blue-600 hover:underline" onClick={() => setPdfOpen(false)}>
                Fechar
              </button>
            </div>

            <PDFMedicalReport
              clinic={
                (pdfClinic as PDFClinic) || {
                  name: "—",
                  cnpj: "—",
                  address: "—",
                  city: undefined,
                  phone: "—",
                  email: "—",
                  shortId: "SI",
                }
              }
              patient={
                {
                  id: patient.id,
                  name: patient.name || "Paciente",
                  cpf: patient.cpf,
                  phone: patient.phone,
                  email: patient.email,
                  age: displayAge,
                  birthDate: patient.birth_date,
                  registrationDate: undefined,
                  totalConsultations: totalConsults,
                  lastConsultation: lastConsult ? `${lastConsult.split("/").reverse().join("-")}T00:00:00Z` : null,
                } as PDFPatient
              }
              consultations={pdfConsults}
            />
          </div>
        </div>
      )}
    </div>
  );
}
