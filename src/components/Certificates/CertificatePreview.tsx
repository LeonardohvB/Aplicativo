// src/components/Certificates/CertificatePreview.tsx
import { forwardRef } from "react";
import type { CertificateFormData } from "../../pages/CertificateNew";



// ===== Helpers de formatação =====
const onlyDigits = (s?: string | null) => (s || "").replace(/\D+/g, "");
const formatCPF = (v?: string | null) => {
  const d = onlyDigits(v);
  if (d.length !== 11) return v || "";
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};
const formatCNPJ = (v?: string | null) => {
  const d = onlyDigits(v);
  if (d.length !== 14) return v || "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};
const isoToBR = (iso?: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
};
const formatPhoneBR = (v?: string | null) => {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/^(\d{2})(\d)(\d{4})(\d{4})$/, "($1) $2 $3-$4");
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return v || "";
};

const CERT_TYPES: Record<
  CertificateFormData["certificateType"],
  { label: string }
> = {
  saude: { label: "Atestado de Saúde" },
  comparecimento: { label: "Atestado de Comparecimento" },
  afastamento: { label: "Atestado de Afastamento" },
  aptidao: { label: "Atestado de Aptidão" },
  incapacidade: { label: "Atestado de Incapacidade" },
};

type Props = {
  data: CertificateFormData;
};

const CertificatePreview = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  return (
    <div ref={ref} className="certificate-container max-w-3xl mx-auto bg-white shadow-2xl">
      {/* Header */}
<div className="border-b-4 border-blue-600 p-12 bg-white">
  <div className="flex items-center gap-4 mb-6">

    {/* Logo */}
    {data.clinicLogoUrl ? (
      <img
        src={data.clinicLogoUrl}
        alt="Logo da Clínica"
        className="w-24 h-24 object-contain rounded-lg shadow-sm"
      />
    ) : (
      <div className="w-20 h-20 bg-blue-600 text-white flex items-center justify-center rounded-lg text-2xl font-bold">
        {(data.clinicName || "CL").slice(0, 2).toUpperCase()}
      </div>
    )}

    <div className="flex-1 text-center pr-20">
      <h1 className="text-3xl font-bold text-gray-900">ATESTADO</h1>
      <p className="text-sm text-gray-600 font-semibold">
        {CERT_TYPES[data.certificateType].label}
      </p>
      <div className="mt-3 inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
        Documento Oficial
      </div>
    </div>
  </div>
</div>


      {/* Body */}
      <div className="p-12 space-y-8 text-justify">
        <p className="text-sm text-gray-600 font-semibold">
          {data.clinicName || "Clínica"} certifica que
        </p>

        {/* Patient */}
        <div className="space-y-2 text-gray-800">
          <p className="text-lg font-bold">{data.patientName}</p>
          <p className="text-sm">
            {data.patientCPF ? <>CPF: {formatCPF(data.patientCPF)}</> : null}
            {data.patientPhone ? <>{" "} | {" "}Tel: {formatPhoneBR(data.patientPhone)}</> : null}
            {data.patientBirthISO ? <>{" "} | {" "}Nasc.: {isoToBR(data.patientBirthISO)}</> : null}
          </p>
        </div>

        {/* Main */}
        <div className="space-y-4 text-gray-800 leading-relaxed">
          {["afastamento", "incapacidade"].includes(data.certificateType) ? (
  <>
    <p>
      O paciente esteve sob atendimento nesta instituição e necessita de
      afastamento no período de{" "}
      <span className="font-bold underline">{isoToBR(data.startDate)}</span> a{" "}
      <span className="font-bold underline">{isoToBR(data.endDate)}</span>, totalizando{" "}
      <span className="font-bold underline">
{(data.daysOfAbsence ?? 1)} dia{(data.daysOfAbsence ?? 1) > 1 ? "s" : ""}
      </span>.
    </p>

    {data.requiresRest && (
      <p>
        Durante este período, é indicado <strong>repouso obrigatório</strong>.
      </p>
    )}
  </>
) : (
  <p>
    Compareceu a esta instituição em{" "}
    <span className="font-bold underline">{isoToBR(data.issueDate)}</span>{" "}
    para{" "}
    <span className="font-bold underline">{data.reason}</span>.
  </p>
)}

          {/* ⚠️ Agora SEMPRE mostramos se houver conteúdo */}
          {data.restrictedActivities ? (
            <p>
              Atividades restritas:{" "}
              <span className="font-bold">{data.restrictedActivities}</span>
            </p>
          ) : null}

          {data.observations ? (
            <p className="italic text-gray-700">Observações: {data.observations}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="pt-12 space-y-12">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-8">_________________________________</p>
            <p className="font-bold text-gray-900">{data.professionalName}</p>
            {data.professionalSpecialty ? (
              <p className="text-sm text-gray-600">{data.professionalSpecialty}</p>
            ) : null}
            {data.professionalCRM ? (
              <p className="text-sm text-gray-600">{data.professionalCRM}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 text-center text-sm">
            <div>
              <p className="text-gray-600 mb-4">Documento emitido em:</p>
              <p className="font-semibold text-gray-900">
                {isoToBR(data.issueDate)}
              </p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">{data.clinicName || "Clínica"}</p>
              {data.clinicCNPJ ? (
                <p className="text-xs text-gray-600">{formatCNPJ(data.clinicCNPJ)}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-300 text-center text-xs text-gray-600">
          <p>Este documento é válido como comprovação de atendimento.</p>
          <p>Guarde uma cópia para seus registros.</p>
        </div>
      </div>
    </div>
  );
});

CertificatePreview.displayName = "CertificatePreview";
export default CertificatePreview;
