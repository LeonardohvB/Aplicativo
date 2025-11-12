// src/components/Professionals/AddProfessionalModal.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { titleAllWordsLive, titleAllWordsFinal } from '../../lib/strings';

interface AddProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (professional: {
    name: string;
    cpf: string;               // <- apenas dígitos
    specialty: string;         // <- preenchido automaticamente, input travado
    phone: string;             // apenas dígitos
    registrationCode: string;  // "SIGLA - número"
    commissionRate?: number;
  }) => Promise<void> | void;   // <- aceita assíncrono
}

/* ===== Helpers de dígitos/telefone ===== */
function onlyDigits(v: string) { return (v || '').replace(/\D+/g, ''); }

function formatBRCell(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const len = d.length;
  if (len === 0) return '';
  if (len <= 2)  return `(${d}`;
  if (len <= 3)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}
const isValidCell = (v: string) => onlyDigits(v).length === 11;

/* ===== CPF (formatação + validação) ===== */
function formatCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  if (d.length <= 3)  return p1;
  if (d.length <= 6)  return `${p1}.${p2}`;
  if (d.length <= 9)  return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
}

function isValidCPF(cpfStr: string) {
  const cpf = onlyDigits(cpfStr);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais

  const calcCheck = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  const d1 = calcCheck(cpf.slice(0, 9), 10);
  const d2 = calcCheck(cpf.slice(0, 10), 11);

  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/* ===== Nome completo (mínimo nome + sobrenome) ===== */
function hasFirstAndLastName(full: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  const strong = parts.filter(p => p.replace(/[^a-zá-úà-ùãõç]/gi, '').length >= 2);
  return strong.length >= 2;
}

/* ===== Conselhos ===== */
const COUNCILS = ['CRM','CREA','CREFITO','CRP','CRO','COREN','CRF','CRFa','CRN','CRESS','CREF','OUTRO'];

/* ===== Mapeamento Conselho -> Profissão (auto-preenchimento) ===== */
const COUNCIL_TO_PROFESSION: Record<string, string> = {
  CRM: 'Médico(a)',
  CRP: 'Psicólogo(a)',
  CRO: 'Dentista',
  CREFITO: 'Fisioterapeuta',
  CRFa: 'Fonoaudiólogo(a)',
  CRN: 'Nutricionista',
  COREN: 'Enfermeiro(a)',
  CRESS: 'Assistente Social',
  CREF: 'Profissional de Educação Física',
  CRF: 'Farmacêutico(a)',
  CRMV: 'Médico(a) Veterinário(a)',
  CRBM: 'Biomédico(a)',
  CREA: 'Engenheiro(a)',
};

export default function AddProfessionalModal({
  isOpen,
  onClose,
  onAdd,
}: AddProfessionalModalProps) {
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [specialty, setSpecialty] = useState(''); // <- preenchido automaticamente
  const [phone, setPhone] = useState('');

  // Registro (sigla + número)
  const [council, setCouncil] = useState<string>('CRM');
  const [customCouncil, setCustomCouncil] = useState('');
  const [regNumber, setRegNumber] = useState('');

  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  const [errors, setErrors] = useState<{
    name?: string;
    cpf?: string;
    phone?: string;
    regNumber?: string;
    customCouncil?: string;
    generic?: string;
  }>({});
  const [shake, setShake] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const auto = COUNCIL_TO_PROFESSION[council] ?? '';
    setSpecialty(auto);
  }, [council]);

  useEffect(() => {
    if (!isOpen) {
      setName(''); setCpf('');
      setSpecialty(COUNCIL_TO_PROFESSION['CRM'] ?? '');
      setPhone('');
      setCouncil('CRM'); setCustomCouncil(''); setRegNumber('');
      setCommissionRate(''); setErrors({}); setShake(false); setSaving(false);
    }
  }, [isOpen]);

  // 🔒 Bloqueia o scroll do body quando o modal está aberto (iOS-friendly)
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(s => ({ ...s, generic: undefined }));
    const nextErrors: typeof errors = {};

    // Nome completo
    if (!name.trim()) nextErrors.name = 'Informe o nome completo.';
    else if (!hasFirstAndLastName(name)) nextErrors.name = 'Mínimo: nome e sobrenome.';

    // CPF
    if (!cpf.trim()) nextErrors.cpf = 'Informe o CPF.';
    else if (onlyDigits(cpf).length !== 11) nextErrors.cpf = 'CPF deve ter 11 dígitos.';
    else if (!isValidCPF(cpf)) nextErrors.cpf = 'CPF inválido.';

    // Telefone
    const phoneDigits = onlyDigits(phone);
    if (phoneDigits.length !== 11) nextErrors.phone = 'Telefone celular deve ter 11 dígitos (DDD + 9).';

    // Conselho/Registro
    const chosenCouncil = council === 'OUTRO'
      ? (customCouncil || '').trim().toUpperCase()
      : council.toUpperCase();
    if (council === 'OUTRO' && !chosenCouncil) nextErrors.customCouncil = 'Informe a sigla do conselho.';
    if (!regNumber.trim()) nextErrors.regNumber = 'Informe o número do registro.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShake(true);
      setTimeout(() => setShake(false), 260);
      return;
    }

    const registrationCode = `${chosenCouncil} - ${regNumber.trim()}`;

    setSaving(true);
    try {
      await onAdd({
        name: name.trim(),
        cpf: onlyDigits(cpf),
        specialty,
        phone: phoneDigits,
        registrationCode,
        commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
      });
      onClose();
    } catch (err: any) {
      const msg: string = err?.message || String(err) || 'Erro ao salvar.';
      const normalized = msg.toLowerCase();

      if (normalized.includes('cpf já está cadastrado') ||
          normalized.includes('duplicado') ||
          normalized.includes('duplicate key') ||
          normalized.includes('unique constraint') ||
          normalized.includes('ux_professionals_cpf')) {
        setErrors(s => ({ ...s, cpf: 'Este CPF já está cadastrado para outro profissional.' }));
      } else {
        setErrors(s => ({ ...s, generic: msg }));
      }

      setShake(true);
      setTimeout(() => setShake(false), 260);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 overscroll-contain">
      <div
        className={`w-full max-w-md max-h-[min(680px,calc(100vh-24px))] overflow-y-auto rounded-xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl ${shake ? 'animate-shake' : ''}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cadastrar profissional</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome completo</label>
            <input
              value={name}
              onChange={(e) => {
                setName(titleAllWordsLive(e.target.value));
                if (errors.name) setErrors(s => ({ ...s, name: undefined }));
              }}
              onBlur={() => setName((v) => titleAllWordsFinal(v))}
              disabled={saving}
              className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                errors.name
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
              }`}
              placeholder="Nome e sobrenome"
              aria-invalid={!!errors.name}
            />
            <p className={`mt-1 text-xs ${errors.name ? 'text-red-600' : 'text-gray-400'}`}>
              {errors.name ? errors.name : 'Mínimo: nome e sobrenome.'}
            </p>
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700">CPF</label>
            <input
              value={cpf}
              onChange={(e) => {
                setCpf(formatCPF(e.target.value));
                if (errors.cpf) setErrors(s => ({ ...s, cpf: undefined }));
              }}
              inputMode="numeric"
              disabled={saving}
              placeholder="000.000.000-00"
              className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                errors.cpf
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
              }`}
              aria-invalid={!!errors.cpf}
            />
            <p className={`mt-1 text-xs ${errors.cpf ? 'text-red-600' : 'text-gray-400'}`}>
              {errors.cpf ? errors.cpf : 'Digite 11 dígitos (serão validados).'}
            </p>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone (celular)</label>
            <input
              value={phone}
              onChange={(e) => {
                setPhone(formatBRCell(e.target.value));
                if (errors.phone) setErrors(s => ({ ...s, phone: undefined }));
              }}
              type="tel"
              inputMode="numeric"
              disabled={saving}
              placeholder="(81) 9 9999-9999"
              className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                (phone && !isValidCell(phone)) || errors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
              }`}
              aria-invalid={(phone && !isValidCell(phone)) || !!errors.phone}
            />
            <p className={`mt-1 text-xs ${(phone && !isValidCell(phone)) || errors.phone ? 'text-red-600' : 'text-gray-400'}`}>
              {(errors.phone ?? 'Informe 11 dígitos (DDD + 9).')}
            </p>
          </div>

          {/* Registro Profissional */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Registro Profissional (obrigatório)</label>

            <div className="mt-1 flex gap-2">
              <select
                value={council}
                onChange={(e) => {
                  setCouncil(e.target.value);
                  if (errors.customCouncil) setErrors(s => ({ ...s, customCouncil: undefined }));
                }}
                disabled={saving}
                className="w-[44%] rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              >
                {COUNCILS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {council === 'OUTRO' && (
                <input
                  value={customCouncil}
                  onChange={(e) => {
                    setCustomCouncil(e.target.value.toUpperCase());
                    if (errors.customCouncil) setErrors(s => ({ ...s, customCouncil: undefined }));
                  }}
                  disabled={saving}
                  placeholder="Sigla (ex.: CRM)"
                  className={`w-[30%] rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    errors.customCouncil
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
                  }`}
                  aria-invalid={!!errors.customCouncil}
                />
              )}

              <input
                value={regNumber}
                onChange={(e) => {
                  setRegNumber(e.target.value);
                  if (errors.regNumber) setErrors(s => ({ ...s, regNumber: undefined }));
                }}
                disabled={saving}
                placeholder="número (ex.: 26465 / SP)"
                className={`flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                  errors.regNumber
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
                }`}
                aria-invalid={!!errors.regNumber}
              />
            </div>

            {(errors.customCouncil || errors.regNumber) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.customCouncil ?? errors.regNumber}
              </p>
            )}

            <div className="mt-1 text-xs text-gray-500">
              Pré-visualização:{' '}
              <span className="font-medium text-gray-700">
                {(council === 'OUTRO' ? (customCouncil || '').toUpperCase() : council.toUpperCase()) || '—'} - {regNumber || '—'}
              </span>
            </div>
          </div>

          {/* Profissão/Especialidade — TRAVADO (auto) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
              value={specialty}
              readOnly
              disabled
              className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed"
              placeholder="Preencha o registro profissional para definir automaticamente"
            />
            <p className="mt-1 text-xs text-gray-400">
              Este campo é preenchido automaticamente pelo registro profissional.
            </p>
          </div>

          {/* Erro genérico (backend) */}
          {errors.generic && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.generic}
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 sticky bottom-0 bg-white/95 backdrop-blur-sm pb-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
