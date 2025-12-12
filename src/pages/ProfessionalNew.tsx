// src/pages/ProfessionalNew.tsx
import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useProfessionals } from "../hooks/useProfessionals";
import { titleAllWordsLive, titleAllWordsFinal } from "../lib/strings";

/* ========= Helpers ========= */

const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

function formatCell(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7)
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

const isValidCell = (v: string) => onlyDigits(v).length === 11;

function formatCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3) return p1;
  if (d.length <= 6) return `${p1}.${p2}`;
  if (d.length <= 9) return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function isValidCPF(cpfStr: string) {
  const cpf = onlyDigits(cpfStr);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcCheck = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++)
      sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcCheck(cpf.slice(0, 9), 10);
  const d2 = calcCheck(cpf.slice(0, 10), 11);

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function hasFirstAndLastName(full: string) {
  const parts = (full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const strong = parts.filter(
    (p) => p.replace(/[^a-zá-úà-ùãõç]/gi, "").length >= 2
  );
  return strong.length >= 2;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());
}


/* Conselhos */
const COUNCILS = [
  "CRM",
  "CREA",
  "CREFITO",
  "CRP",
  "CRO",
  "COREN",
  "CRF",
  "CRFa",
  "CRN",
  "CRESS",
  "CREF",
  "OUTRO",
];

const COUNCIL_TO_PROFESSION: Record<string, string> = {
  CRM: "Médico(a)",
  CRP: "Psicólogo(a)",
  CRO: "Dentista",
  CREFITO: "Fisioterapeuta",
  CRFa: "Fonoaudiólogo(a)",
  CRN: "Nutricionista",
  COREN: "Enfermeiro(a)",
  CRESS: "Assistente Social",
  CREF: "Profissional de Educação Física",
  CRF: "Farmacêutico(a)",
  CRMV: "Médico(a) Veterinário(a)",
  CRBM: "Biomédico(a)",
  CREA: "Engenheiro(a)",
};

export default function ProfessionalNew({ onBack }: { onBack: () => void }) {
  const { addProfessional, refetch } = useProfessionals();

  /* Form */
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");


  const [council, setCouncil] = useState("CRM");
  const [customCouncil, setCustomCouncil] = useState("");
  const [regNumber, setRegNumber] = useState("");

  const [specialty, setSpecialty] = useState("");

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  /* Atualiza especialidade automaticamente */
  useEffect(() => {
    const auto = COUNCIL_TO_PROFESSION[council] ?? "";
    setSpecialty(auto);
  }, [council]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: any = {};

    if (!hasFirstAndLastName(name))
      next.name = "Informe nome e sobrenome.";

    if (!isValidCPF(cpf))
      next.cpf = "CPF inválido.";

    if (!isValidCell(phone))
      next.phone = "Informe 11 dígitos (DDD + 9).";

    if (!isValidEmail(email))
      next.email = "Informe um e-mail válido.";


    const chosen = council === "OUTRO"
      ? (customCouncil || "").toUpperCase()
      : council;

    if (council === "OUTRO" && !chosen)
      next.customCouncil = "Informe o conselho.";

    if (!regNumber.trim())
      next.regNumber = "Informe o número do registro.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const registrationCode = `${chosen} - ${regNumber.trim()}`;

    setSaving(true);
    try {
      await addProfessional({
  name: name.trim(),
  email: email.trim().toLowerCase(),
  cpf: onlyDigits(cpf),
  specialty,
  phone: onlyDigits(phone),
  registrationCode,
} as any);


      await refetch();
      onBack();
    } catch (err: any) {
      setErrors({ generic: err?.message || "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ===== BOTÃO VOLTAR (igual ao cadastro de paciente) ===== */}
      <div className="px-4 pt-4 mb-2">
        <button
          onClick={onBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>
      </div>

      {/* ===== CARD CENTRAL (estrutura idêntica ao PatientsNew) ===== */}
      <div className="w-full max-w-[1120px] mx-auto px-4 pb-20">
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="mx-auto w-full max-w-5xl px-4 md:px-6">

            {/* HEADER DO CARD */}
            
              <div className="px-4 sm:px-6 py-4 text-center">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  Cadastrar Profissional
                </h1>
              </div>
           

            {/* ===== FORM ORIGINAL (inalterado) ===== */}
            <div className="p-4">
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Nome */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Nome completo</label>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(titleAllWordsLive(e.target.value));
                      setErrors((s: any) => ({ ...s, name: undefined }));
                    }}
                    onBlur={() => setName((v) => titleAllWordsFinal(v))}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                      errors.name ? "border-red-400" : "border-gray-300"
                    }`}
                    placeholder="Nome e sobrenome"
                  />
                  {errors.name && (
                    <p className="text-red-600 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label className="text-sm font-medium text-gray-700">CPF</label>
                  <input
                    value={cpf}
                    onChange={(e) => {
                      setCpf(formatCPF(e.target.value));
                      setErrors((s: any) => ({ ...s, cpf: undefined }));
                    }}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                      errors.cpf ? "border-red-400" : "border-gray-300"
                    }`}
                    placeholder="000.000.000-00"
                  />
                  {errors.cpf && (
                    <p className="text-red-600 text-xs mt-1">{errors.cpf}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Telefone</label>
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(formatCell(e.target.value));
                      setErrors((s: any) => ({ ...s, phone: undefined }));
                    }}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 ${
                      errors.phone ? "border-red-400" : "border-gray-300"
                    }`}
                    placeholder="(81) 9 9999-9999"
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                {/* E-mail */}
<div>
  <label className="text-sm font-medium text-gray-700">
    E-mail profissional
  </label>
  <input
    type="email"
    value={email}
    onChange={(e) => {
      setEmail(e.target.value.toLowerCase().trim());
      setErrors((s: any) => ({ ...s, email: undefined }));
    }}
    className={`mt-1 w-full rounded-lg border px-3 py-2 ${
      errors.email ? "border-red-400" : "border-gray-300"
    }`}
    placeholder="email@clinica.com"
  />
  {errors.email && (
    <p className="text-red-600 text-xs mt-1">{errors.email}</p>
  )}
</div>


                {/* Registro */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Registro Profissional
                  </label>

                  <div className="mt-1 flex gap-2 flex-wrap">
                    <select
                      value={council}
                      onChange={(e) => {
                        setCouncil(e.target.value);
                        setErrors((s: any) => ({ ...s, customCouncil: undefined }));
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2"
                    >
                      {COUNCILS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>

                    {council === "OUTRO" && (
                      <input
                        value={customCouncil}
                        onChange={(e) => {
                          setCustomCouncil(e.target.value.toUpperCase());
                        }}
                        placeholder="Sigla"
                        className={`rounded-lg border px-3 py-2 ${
                          errors.customCouncil
                            ? "border-red-400"
                            : "border-gray-300"
                        }`}
                      />
                    )}

                    <input
                      value={regNumber}
                      onChange={(e) => {
                        setRegNumber(e.target.value);
                        setErrors((s: any) => ({ ...s, regNumber: undefined }));
                      }}
                      placeholder="Número"
                      className={`flex-1 rounded-lg border px-3 py-2 ${
                        errors.regNumber ? "border-red-400" : "border-gray-300"
                      }`}
                    />
                  </div>

                  {(errors.customCouncil || errors.regNumber) && (
                    <p className="text-red-600 text-xs mt-1">
                      {errors.customCouncil ?? errors.regNumber}
                    </p>
                  )}

                  <p className="text-xs text-gray-500 mt-1">
                    Pré-visualização:{" "}
                    <span className="font-medium">
                      {(council === "OUTRO"
                        ? customCouncil || "—"
                        : council) + " - " + (regNumber || "—")}
                    </span>
                  </p>
                </div>

                {/* Especialidade */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Especialidade
                  </label>
                  <input
                    value={specialty}
                    readOnly
                    disabled
                    className="mt-1 w-full rounded-lg border bg-gray-100 text-gray-700 px-3 py-2"
                  />
                </div>

                {/* Erro genérico */}
                {errors.generic && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errors.generic}
                  </div>
                )}

                {/* BOTÕES */}
                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
