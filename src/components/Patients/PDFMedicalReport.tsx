// src/components/Patients/PDFMedicalReport.tsx
import React, { useRef, useState } from "react";
import { Download, Eye, Printer } from "lucide-react";

/* =========================
   Tipos exportados (reuse)
   ========================= */
export type PDFClinic = {
  name: string;
  cnpj: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  shortId?: string; // opcional para avatar/monograma (ex.: "SI")
};

export type PDFPatient = {
  id: string;
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  birthDate?: string;           // "DD/MM/AAAA" (opcional)
  registrationDate?: string;    // "DD/MM/AAAA" (opcional)
  age?: number | null;
  totalConsultations?: number | null;
  lastConsultation?: string | null; // "DD/MM/AAAA"
};

export type PDFConsultation = {
  id: string | number;
  date: string;   // "DD/MM/AAAA"
  time: string;   // "HH:mm"
  professional: string;
  specialty: string;
  type: string;   // título (ex.: "Consulta (online)")
  symptoms: string[];
  diagnosis: string;
  conduct: string;
  observations: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  medications: Array<{ name: string; dosage?: string; frequency?: string; duration?: string }>;
  vitals: { pressure?: string; heartRate?: string; temperature?: string; weight?: string };
};

type Props = {
  clinic: PDFClinic;
  patient: PDFPatient;
  consultations: PDFConsultation[];
};

/* =========================
   Helpers visuais
   ========================= */
function getSpecialtyColor(s: string) {
  const map: Record<string, string> = {
    Psicologia: "border-purple-600",
    "Clínico Geral": "border-blue-600",
    Fisioterapia: "border-green-600",
    Psiquiatria: "border-red-600",
    Cardiologia: "border-red-500",
    Neurologia: "border-yellow-600",
  };
  return map[s] || "border-blue-600";
}
function getSpecialtyBg(s: string) {
  const map: Record<string, string> = {
    Psicologia: "bg-purple-50",
    "Clínico Geral": "bg-blue-50",
    Fisioterapia: "bg-green-50",
    Psiquiatria: "bg-red-50",
    Cardiologia: "bg-red-50",
    Neurologia: "bg-yellow-50",
  };
  return map[s] || "bg-blue-50";
}

const safe = (v?: string | number | null, dash = "—") =>
  (v ?? "") === "" || v == null ? dash : String(v);

/* =========================
   Componente principal
   ========================= */
export default function PDFMedicalReport({ clinic, patient, consultations }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"preview" | "none">("preview");

  const fileStamp = String(Date.now()).slice(-6);
  const generatedAtDate = new Date().toLocaleDateString("pt-BR");
  const generatedAtTime = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handlePrint = () => window.print();

  const generatePDF = () => {
    const el = printRef.current;
    if (!el) return;
    // Usa html2pdf se estiver presente (inclua o bundle via index.html)
    const w = window as any;
    const opt = {
      margin: 10,
      filename: `Prontuario_${(patient.name || "Paciente").replace(/\s+/g, "_")}_${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };
    if (w.html2pdf) w.html2pdf().set(opt).from(el).save();
    else window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      {/* Estilos de impressão */}
      <style>{`
        @media print {
          * { margin: 0; padding: 0; }
          body { background: white; }
          .no-print { display: none !important; }
          .pdf-container { box-shadow: none; max-width: 100%; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>

      {/* Controles */}
      <div className="no-print mb-6 flex gap-3 justify-center sticky top-4 z-10">
        <button
          onClick={() => setViewMode("preview")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === "preview"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          }`}
        >
          <Eye size={18} />
          Visualizar
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-all"
        >
          <Printer size={18} />
          Imprimir
        </button>

        <button
          onClick={generatePDF}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-all shadow-lg"
        >
          <Download size={18} />
          Baixar PDF
        </button>
      </div>

      {/* CONTEÚDO DO PDF */}
      <div ref={printRef} className="pdf-container max-w-4xl mx-auto bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 sm:p-8">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-lg flex items-center justify-center shadow-lg shrink-0">
                <span className="text-blue-700 font-bold text-xl sm:text-2xl">
                  {safe(clinic.shortId, "SI")}
                </span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">{safe(clinic.name)}</h1>
                <p className="text-blue-100 text-xs sm:text-sm">CNPJ: {safe(clinic.cnpj)}</p>
                <p className="text-blue-100 text-xs sm:text-sm">{safe(clinic.address)}</p>
                <p className="text-blue-100 text-xs sm:text-sm">{safe(clinic.city)}</p>
                <p className="text-blue-100 text-xs sm:text-sm mt-1">
                  Tel: {safe(clinic.phone)} | Email: {safe(clinic.email)}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="bg-white text-blue-800 px-3 py-2 sm:px-4 sm:py-3 rounded-lg shadow-lg mb-2">
                <p className="text-[10px] sm:text-xs font-semibold">Documento de Prontuário</p>
                <p className="text-base sm:text-lg font-bold">PRONTUÁRIO #{fileStamp}</p>
              </div>
              <p className="text-xs sm:text-sm text-blue-100">
                Gerado em: {generatedAtDate} às {generatedAtTime}
              </p>
            </div>
          </div>
        </div>

        {/* Dados do Paciente */}
        <div className="p-6 sm:p-8 bg-gray-50 border-b-4 border-blue-600">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-600">
            INFORMAÇÕES DO PACIENTE
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Nome Completo
              </p>
              <p className="text-lg font-bold text-gray-900">{safe(patient.name)}</p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">CPF</p>
              <p className="text-lg font-bold text-gray-900">{safe(patient.cpf)}</p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Idade / Data de Nascimento
              </p>
              <p className="text-lg font-bold text-gray-900">
                {patient.age != null ? `${patient.age} anos` : "—"}
                {patient.birthDate ? ` / ${patient.birthDate}` : ""}
              </p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Data de Cadastro
              </p>
              <p className="text-lg font-bold text-gray-900">{safe(patient.registrationDate)}</p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Total de Consultas
              </p>
              <p className="text-lg font-bold text-gray-900">
                {patient.totalConsultations ?? "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Última Consulta
              </p>
              <p className="text-lg font-bold text-gray-900">{safe(patient.lastConsultation)}</p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase mb-1">
                Telefone/Email
              </p>
              <p className="text-sm text-gray-800">
                {safe(patient.phone)} {patient.phone && patient.email ? " | " : ""} {safe(patient.email)}
              </p>
            </div>
          </div>
        </div>

        {/* Histórico Clínico */}
        <div className="p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-6 pb-2 border-b-2 border-blue-600">
            HISTÓRICO CLÍNICO COMPLETO
          </h2>

          {consultations.length === 0 ? (
            <div className="text-sm text-gray-600">Sem atendimentos registrados.</div>
          ) : (
            <div className="space-y-8">
              {consultations.map((c, idx) => (
                <div
                  key={c.id}
                  className={`border-l-4 ${getSpecialtyColor(c.specialty)} pl-6 pb-6 ${
                    idx !== consultations.length - 1 ? "border-b-2 border-gray-200" : ""
                  }`}
                >
                  {/* Cabeçalho da consulta */}
                  <div className={`${getSpecialtyBg(c.specialty)} p-4 rounded-lg mb-4`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">{safe(c.type)}</h3>
                        <p className="text-sm text-gray-600">
                          {safe(c.professional)} • {safe(c.specialty)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700">{safe(c.date)}</p>
                        <p className="text-sm text-gray-600">{safe(c.time)}</p>
                      </div>
                    </div>

                    {/* Sintomas */}
                    {c.symptoms?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {c.symptoms.map((s, i) => (
                          <span
                            key={`${c.id}-sym-${i}`}
                            className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded"
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
                    c.vitals?.weight) && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-3">Sinais Vitais</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="text-xs">
                          <p className="text-gray-600 uppercase font-semibold mb-1">Pressão</p>
                          <p className="font-bold text-gray-900">{safe(c.vitals?.pressure)}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-gray-600 uppercase font-semibold mb-1">FC</p>
                          <p className="font-bold text-gray-900">{safe(c.vitals?.heartRate)}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-gray-600 uppercase font-semibold mb-1">Temp.</p>
                          <p className="font-bold text-gray-900">{safe(c.vitals?.temperature)}</p>
                        </div>
                        <div className="text-xs">
                          <p className="text-gray-600 uppercase font-semibold mb-1">Peso</p>
                          <p className="font-bold text-gray-900">{safe(c.vitals?.weight)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Blocos SOAP */}
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-600 pl-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">S - Subjetivo</p>
                      <p className="text-sm text-gray-800">{safe(c.subjective)}</p>
                    </div>
                    <div className="border-l-4 border-green-600 pl-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">O - Objetivo</p>
                      <p className="text-sm text-gray-800">{safe(c.objective)}</p>
                    </div>
                    <div className="border-l-4 border-purple-600 pl-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">A - Avaliação</p>
                      <p className="text-sm text-gray-800">{safe(c.assessment)}</p>
                    </div>
                    <div className="border-l-4 border-orange-600 pl-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">P - Plano</p>
                      <p className="text-sm text-gray-800">{safe(c.plan)}</p>
                    </div>
                  </div>

                  {/* Medicações */}
                  {c.medications?.length > 0 && (
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-2">Medicações Prescritas</p>
                      {c.medications.map((m, i) => (
                        <div key={`${c.id}-med-${i}`} className="text-sm text-gray-800">
                          <p className="font-semibold">
                            {safe(m.name)}{m.dosage ? ` - ${m.dosage}` : ""}
                          </p>
                          {(m.frequency || m.duration) && (
                            <p className="text-gray-600">
                              {safe(m.frequency)}{m.frequency && m.duration ? " | " : ""}{safe(m.duration)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observações (se quiser além do S/O) */}
                  {c.observations && (
                    <div className="mt-3">
                      <p className="text-[11px] font-bold text-gray-600 uppercase mb-1">Observações</p>
                      <p className="text-sm text-gray-800">{c.observations}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assinaturas */}
        <div className="p-6 sm:p-8 bg-gray-50 border-t-4 border-blue-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-12">_____________________________</p>
              <p className="text-xs font-bold text-gray-600">Assinatura do Profissional</p>
              <p className="text-xs text-gray-600">Última consulta realizada</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-12">_____________________________</p>
              <p className="text-xs font-bold text-gray-600">Assinatura do Paciente</p>
              <p className="text-xs text-gray-600">{safe(patient.name)}</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-gray-800 text-white p-6 text-center text-[11px] sm:text-xs">
          <p className="mb-2 font-semibold">DOCUMENTO CONFIDENCIAL - SIGILO MÉDICO</p>
          <p className="text-gray-300 mb-2">
            Este prontuário contém informações protegidas por sigilo profissional. Acesso restrito a profissionais autorizados.
          </p>
          <p className="text-gray-400">{safe(clinic.name)} - CNPJ: {safe(clinic.cnpj)}</p>
          <p className="text-gray-500 mt-2">
            Página 1 de 1 | {consultations.length} atendimento(s) registrado(s) | Gerado em {generatedAtDate} às {generatedAtTime}
          </p>
        </div>
      </div>
    </div>
  );
}
