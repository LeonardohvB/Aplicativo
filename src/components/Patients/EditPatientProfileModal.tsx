import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Patient = {
  id: string;
  name: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSaved?: (p: Patient) => void; // devolve atualizado (opcional)
}

/* ------------ helpers (iguais ao AddPatientModal) ------------ */
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');

const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
function capPart(part: string, forceCap: boolean) {
  const ap = part.match(/^([a-z])'([a-z].*)$/i);
  if (ap) return ap[1].toUpperCase() + "'" + (ap[2][0]?.toUpperCase() + ap[2].slice(1));
  if (!forceCap && LOWERCASE_WORDS.has(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}
function titleCaseNameBRLive(input: string) {
  if (!input) return '';
  if (/^\s+$/.test(input)) return '';
  const hadTrailingSpace = /\s$/.test(input);
  const core = input.toLowerCase().replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
  const words = core
    .split(' ')
    .filter(Boolean)
    .map((w, idx) =>
      w.includes('-')
        ? w.split('-').map((p) => (p ? capPart(p, idx === 0) : '')).join('-')
        : capPart(w, idx === 0)
    )
    .join(' ');
  if (words === '') return '';
  return hadTrailingSpace ? words + ' ' : words;
}
function titleCaseNameBRFinal(input: string) {
  return titleCaseNameBRLive(input).trim();
}
/* ------------------------------------------------------------- */

export default function EditPatientProfileModal({
  isOpen,
  onClose,
  patient,
  onSaved,
}: Props) {
  const [name, setName] = useState('');
  const [cpf, setCPF] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // carregar dados do paciente ao abrir
  useEffect(() => {
    if (!isOpen || !patient) return;
    setName(patient.name || '');
    setCPF(patient.cpf || '');
    setPhone(patient.phone || '');
    setEmail(patient.email || '');
    setErrors({});
    setShake(false);
    setLoading(false);
  }, [isOpen, patient]);

  if (!isOpen || !patient) return null;

  const inputClass = (hasErr: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      hasErr
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome.';
    const digits = onlyDigits(phone);
    if (digits && digits.length !== 11) e.phone = 'Telefone deve ter 11 dígitos.';
    return e;
  };

  const shakeNow = () => {
    setShake(true);
    setTimeout(() => setShake(false), 260);
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      shakeNow();
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        // cpf bloqueado: não atualiza
        phone: onlyDigits(phone) || null,
        email: email.trim() || null,
      };

      const { data, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', patient.id)
        .select()
        .single();

      if (error) throw error;

      onSaved?.(data as Patient);
      onClose();
    } catch (err: any) {
      setErrors((s) => ({ ...s, _global: err?.message || 'Erro ao salvar.' }));
      shakeNow();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* shake local sem depender do Tailwind */}
      <style>{`
        @keyframes modalShake {
          10% { transform: translateX(-4px); }
          20% { transform: translateX(4px); }
          30% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          70% { transform: translateX(-1px); }
          80% { transform: translateX(1px); }
          100% { transform: translateX(0); }
        }
        .shake { animation: modalShake 260ms ease-in-out; }
      `}</style>

      <div className={`w-full max-w-md rounded-xl bg-white p-5 shadow-xl ${shake ? 'shake' : ''}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Editar cadastro do paciente</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        {errors._global && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
            {errors._global}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome *</label>
            <input
              value={name}
              onChange={(e) => {
                setName(titleCaseNameBRLive(e.target.value));
                if (errors.name) setErrors((s) => ({ ...s, name: '' }));
              }}
              onBlur={() => setName((v) => titleCaseNameBRFinal(v))}
              className={inputClass(!!errors.name)}
              placeholder="Nome completo"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* CPF (bloqueado para manter chave única) */}
          <div>
            <label className="block text-sm font-medium text-gray-700">CPF</label>
            <input
              value={formatCPF(cpf)}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              O CPF é único e não pode ser alterado aqui.
            </p>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              value={formatBRCell(phone)}
              onChange={(e) => {
                setPhone(e.target.value);
                if (errors.phone) setErrors((s) => ({ ...s, phone: '' }));
              }}
              className={inputClass(!!errors.phone)}
              placeholder="(11) 9 9999-9999"
              inputMode="numeric"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass(false)}
              placeholder="email@exemplo.com"
              type="email"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
