// src/components/Patients/PDFMedicalReport.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ===================== Tipos ===================== */

type Vital = {
  pressure?: string;
  heartRate?: string;
  temperature?: string;
  weight?: string;
  height?: string;
};

type Med = { name: string; freq?: string | null; duration?: string | null };

export type PDFPatient = {
  id: string;
  name: string;
  cpf?: string | null;
  age?: number | null;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;         // "YYYY-MM-DD"
  registrationDate?: string | null;  // "YYYY-MM-DD"
  totalConsultations?: number | null;
  lastConsultation?: string | null;  // ISO / "YYYY-MM-DD"
};

export type PDFClinic = {
  name: string;
  cnpj?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  shortId?: string; // 2 letras
  logoUrl?: string | null;
};

export type PDFConsultation = {
  id: string;
  occurred_at: string; // ISO UTC
  professional: string;
  specialty?: string | null;
  type?: string | null;
  symptoms: string[];
  diagnosis: string[];      // fallback em "A"
  conduct?: string | null;  // fallback em "P"
  observations?: string | null;

  // SOAP
  S?: string;
  O?: string;
  A?: string;
  P?: string;

  vitals: Vital;
  medications?: Med[];
};

type Props = {
  clinic: PDFClinic;
  patient: PDFPatient;
  consultations: PDFConsultation[];
};

declare global {
  interface Window {
    html2pdf?: any;
  }
}

/* ===================== Utils ===================== */

// 🔵 MÁSCARAS — ADICIONE AQUI, logo antes de fmtBR
function maskCNPJ(value?: string | null) {
  const v = (value || "").replace(/\D/g, "");
  if (v.length !== 14) return value || "";
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function maskPhone(value?: string | null) {
  const v = (value || "").replace(/\D/g, "");
  if (v.length < 10) return value || "";

  if (v.length === 11) {
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
  }

  return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
}


function fmtBR(iso?: string | null, mask = "dd/MM/yyyy") {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (isNaN(d.getTime())) return "";
  return format(d, mask, { locale: ptBR });
}

function ensureHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar html2pdf"));
    document.body.appendChild(s);
  });
}

/** Normaliza texto para comparação (sem acento, espaços múltiplos, caixa, pontuação simples). */
function normalize(str?: string | null) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.:；;]+/g, "")
    .trim()
    .toLowerCase();
}

/** Remove duplicações de S/O dentro de observations.
 * - Apaga linhas prefixadas por "Subjetivo:" / "Objetivo:".
 * - Se o restante for vazio ou igual ao S+O (ou O+S), retorna "" para ocultar.
 */
function sanitizeObservations(obs?: string | null, s?: string, o?: string) {
  const raw = (obs || "").trim();
  if (!raw) return "";

  // remove blocos "Subjetivo: ..." e "Objetivo: ..."
  const cleaned = raw
    .replace(/^(\s*Subjetivo\s*:\s*)/gim, "")
    .replace(/^(\s*Objetivo\s*:\s*)/gim, "")
    .replace(/(?:^|\n)\s*Subjetivo\s*:\s*.*$/gim, "")
    .replace(/(?:^|\n)\s*Objetivo\s*:\s*.*$/gim, "")
    .trim();

  // se, mesmo assim, continuar igual ao S+O (ou O+S), some
  const nClean = normalize(cleaned);
  const nSO = normalize([s, o].filter(Boolean).join(" "));
  const nOS = normalize([o, s].filter(Boolean).join(" "));

  if (!nClean || nClean === nSO || nClean === nOS) return "";
  return cleaned;
}

/* ===================== Componente ===================== */

export default function PDFMedicalReport({ clinic, patient, consultations }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"preview" | "print">("preview");

  useEffect(() => { ensureHtml2Pdf().catch(() => {}); }, []);

  const counters = useMemo(() => {
    const total = (patient.totalConsultations ?? consultations.length) || 0;
    const last =
      patient.lastConsultation
        ? fmtBR(patient.lastConsultation)
        : consultations[0]?.occurred_at
        ? fmtBR(consultations[0].occurred_at)
        : null;
    return { total, last };
  }, [patient.totalConsultations, patient.lastConsultation, consultations]);

  const generatePDF = async () => {
    await ensureHtml2Pdf();
    const el = printRef.current;
    if (!el) return;
    const filename = `Prontuario_${(patient.name || "Paciente").replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    const opt = {
      margin: 10,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    if (window.html2pdf) window.html2pdf().set(opt).from(el).save();
    else window.print();
  };

  const spColor = (sp?: string | null) =>
    sp?.toLowerCase().includes("psico") ? "border-purple-600"
    : sp?.toLowerCase().includes("fisio") ? "border-green-600"
    : "border-blue-600";

  const spBg = (sp?: string | null) =>
    sp?.toLowerCase().includes("psico") ? "bg-purple-50"
    : sp?.toLowerCase().includes("fisio") ? "bg-green-50"
    : "bg-blue-50";

  const clinicAddressLine = [clinic.address, clinic.city].filter(Boolean).join(" - ");
  
  return (
    <div className="min-h-[60vh] bg-gray-100 p-4">
      <style>{`
        @media print {
          * { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .pdf-container { box-shadow: none; max-width: 100%; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>

      {/* Controles */}
      <div className="no-print mb-4 flex gap-3 justify-end">
        <button
          onClick={() => setViewMode("preview")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            viewMode === "preview" ? "bg-blue-600 text-white" : "bg-white border"
          }`}
        >
          <Eye size={18} /> Visualizar
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white border"
        >
          <Printer size={18} /> Imprimir
        </button>
        <button
          onClick={generatePDF}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-600 text-white"
        >
          <Download size={18} /> Baixar PDF
        </button>
      </div>

      {/* PDF */}
      <div ref={printRef} className="pdf-container max-w-4xl mx-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="w-14 h-14 bg-white rounded-lg overflow-hidden flex items-center justify-center mb-3 shadow">
  {clinic.logoUrl ? (
    <img
      src={clinic.logoUrl}
      alt="Logo da clínica"
      className="w-full h-full object-cover"  // 👈 preenche toda área
      crossOrigin="anonymous"
    />
  ) : (
    <span className="text-blue-700 font-bold text-xl">
      {clinic.shortId || "CL"}
    </span>
  )}
</div>


              <h1 className="text-2xl font-bold">{clinic.name || "—"}</h1>
{clinic.cnpj && (
  <p className="text-blue-100 text-sm">
    CNPJ: {maskCNPJ(clinic.cnpj)}
  </p>
)}
              {clinicAddressLine && <p className="text-blue-100 text-sm">{clinicAddressLine}</p>}
<p className="text-blue-100 text-sm mt-1">
  {clinic.phone ? `Tel: ${maskPhone(clinic.phone)}` : ""}
  {clinic.email ? ` | Email: ${clinic.email}` : ""}
</p>
            </div>
            <div className="text-right">
              <div className="bg-white text-blue-800 px-3 py-2 rounded-lg shadow mb-2">
                <p className="text-[11px] font-semibold">Documento de Prontuário</p>
                <p className="text-base font-bold">PRONTUÁRIO #{String(Date.now()).slice(-6)}</p>
              </div>
              <p className="text-sm text-blue-100">
                Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        {/* Paciente */}
        <div className="p-6 bg-gray-50 border-b-4 border-blue-600">
          <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b-2 border-blue-600">
            INFORMAÇÕES DO PACIENTE
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Nome</p>
              <p className=" text-gray-900">{patient.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase">CPF</p>
              <p className=" text-gray-900">{patient.cpf || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Idade / Nascimento</p>
              <p className=" text-gray-900">
                {patient.age != null ? `${patient.age} anos` : "—"}
                {patient.birthDate ? ` / ${fmtBR(patient.birthDate)}` : ""}
              </p>
            </div>
             <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Total de consultas</p>
              <p className=" text-gray-900">{counters.total}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Última consulta</p>
              <p className=" text-gray-900">{counters.last || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase">Telefone / Email</p>
              <p className=" text-gray-800">
                {[patient.phone, patient.email].filter(Boolean).join(" | ") || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Histórico */}
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-600">
            HISTÓRICO CLÍNICO COMPLETO
          </h2>

          {consultations.length === 0 ? (
            <p className="text-sm text-gray-600">Sem atendimentos registrados.</p>
          ) : (
            <div className="space-y-6">
              {consultations.map((c, idx) => {
                const dateStr = fmtBR(c.occurred_at);
                const timeStr = fmtBR(c.occurred_at, "HH:mm");

                // 🔧 Observações higienizadas:
                const cleanObs = sanitizeObservations(c.observations, c.S, c.O);

                return (
                  <div
                    key={c.id}
                    className={`border-l-4 ${spColor(c.specialty)} pl-5 pb-5 ${
                      idx !== consultations.length - 1 ? "border-b border-gray-200" : ""
                    }`}
                  >
                    {/* Cabeçalho da consulta */}
                    <div className={`${spBg(c.specialty)} p-3 rounded-lg mb-3`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-base font-bold text-gray-900">{c.type || "Consulta"}</h3>
                          <p className="text-sm text-gray-700">
                            {c.professional} {c.specialty ? `• ${c.specialty}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-700">{dateStr}</p>
                          <p className="text-sm text-gray-600">{timeStr}</p>
                        </div>
                      </div>
                      {c.symptoms?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {c.symptoms.map((s, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-orange-100 text-orange-700 text-[11px] font-semibold rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sinais vitais */}
                    {(c.vitals?.pressure ||
                      c.vitals?.heartRate ||
                      c.vitals?.temperature ||
                      c.vitals?.weight ||
                      c.vitals?.height) && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-2">Sinais Vitais</p>
                        <div className="grid grid-cols-5 gap-2 text-center text-xs">
                          {c.vitals.pressure && (
                            <div>
                              <p className="text-gray-600 font-semibold mb-1">Pressão</p>
                              <p className="font-bold">{c.vitals.pressure}</p>
                            </div>
                          )}
                          {c.vitals.heartRate && (
                            <div>
                              <p className="text-gray-600 font-semibold mb-1">FC</p>
                              <p className="font-bold">{c.vitals.heartRate}</p>
                            </div>
                          )}
                          {c.vitals.temperature && (
                            <div>
                              <p className="text-gray-600 font-semibold mb-1">Temp.</p>
                              <p className="font-bold">{c.vitals.temperature}</p>
                            </div>
                          )}
                          {c.vitals.weight && (
                            <div>
                              <p className="text-gray-600 font-semibold mb-1">Peso</p>
                              <p className="font-bold">{c.vitals.weight}</p>
                            </div>
                          )}
                          {c.vitals.height && (
                            <div>
                              <p className="text-gray-600 font-semibold mb-1">Altura</p>
                              <p className="font-bold">{c.vitals.height}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SOAP */}
                    <div className="space-y-2">
                      <div className="border-l-4 border-blue-600 pl-3">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-0.5">S — Subjetivo</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.S || "—"}</p>
                      </div>

                      <div className="border-l-4 border-green-600 pl-3">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-0.5">O — Objetivo</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.O || "—"}</p>
                      </div>

                      <div className="border-l-4 border-purple-600 pl-3">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-0.5">A — Avaliação</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {c.A || (c.diagnosis || []).join("\n") || "—"}
                        </p>
                      </div>

                      <div className="border-l-4 border-orange-600 pl-3">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-0.5">P — Plano</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.P || c.conduct || "—"}</p>
                      </div>
                    </div>

                    {/* Observações (somente se sobrar algo depois da limpeza) */}
                    {cleanObs ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">Observações</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{cleanObs}</p>
                      </div>
                    ) : null}

                    {/* Medicações */}
                    {(c.medications?.length || 0) > 0 && (
                      <div className="mt-3 p-3 bg-violet-50 rounded-lg border border-violet-200">
                        <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">Medicações</p>
                        <ul className="text-sm text-gray-800 space-y-1">
                          {c.medications!.map((m, i) => (
                            <li key={i}>
                              <span className="font-semibold">{m.name}</span>
                              {(m.freq || m.duration) && (
                                <span className="text-gray-600"> — {[m.freq, m.duration].filter(Boolean).join(" • ")}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-gray-800 text-white p-5 text-center text-[11px]">
          <p className="mb-1 font-semibold">DOCUMENTO CONFIDENCIAL — SIGILO PROFISSIONAL</p>
          <p className="text-gray-300">
  {clinic.name}{clinic.cnpj ? ` — CNPJ: ${maskCNPJ(clinic.cnpj)}` : ""}
</p>

          <p className="text-gray-400 mt-1">
            {counters.total || 0} atendimento(s) | Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}
