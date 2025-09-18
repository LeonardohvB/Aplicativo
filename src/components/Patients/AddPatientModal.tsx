import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type NewPatient = {
  name: string;
  cpf: string;
  phone?: string;
  email?: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (p: any) => void; // opcional: devolve o paciente criado
}

// helpers rápidos
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
};
const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
};
const isValidCPF = (cpfRaw: string) => {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = (s * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
};

export default function AddPatientModal({ isOpen, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [cpf, setCPF] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(''); setCPF(''); setPhone(''); setEmail('');
    setErrors({}); setShake(false); setLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const inputClass = (hasErr: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      hasErr
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  const validate = () => {
    const e: Record<string,string> = {};
    if (!name.trim()) e.name = 'Informe o nome.';
    if (!isValidCPF(cpf)) e.cpf = 'CPF inválido.';
    const digits = onlyDigits(phone);
    if (digits && digits.length !== 11) e.phone = 'Telefone deve ter 11 dígitos.';
    return e;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e); setShake(true); setTimeout(() => setShake(false), 260);
      return;
    }
    setLoading(true);
    try {
      const payload: NewPatient = {
        name: name.trim(),
        cpf: onlyDigits(cpf),
        phone: onlyDigits(phone) || undefined,
        email: email.trim() || undefined,
      };
      const { data, error } = await supabase
        .from('patients')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      onCreated?.(data);
      onClose();
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao cadastrar paciente.');
    } finally {
      setLoading(false);
    }
  };

 // ---- Title Case PT-BR (preserva espaço ao digitar, mas NÃO trava ao apagar) ----
const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function capPart(part: string, forceCap: boolean) {
  const ap = part.match(/^([a-z])'([a-z].*)$/i); // d'ávila -> D'Ávila
  if (ap) return ap[1].toUpperCase() + "'" + (ap[2][0]?.toUpperCase() + ap[2].slice(1));
  if (!forceCap && LOWERCASE_WORDS.has(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/** “Ao digitar”: remove múltiplos espaços, ignora espaços à esquerda,
 *  preserva apenas o espaço final se houver conteúdo. */
function titleCaseNameBRLive(input: string) {
  if (!input) return '';
  if (/^\s+$/.test(input)) return ''; // só espaços -> vira vazio

  const hadTrailingSpace = /\s$/.test(input);

  // normaliza, mas não faz trim direito-esquerda; remove espaços à esquerda
  const core = input
    .toLowerCase()
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '');

  // separa palavras válidas
  const words = core
    .split(' ')
    .filter(Boolean)
    .map((w, idx) =>
      w.includes('-')
        ? w.split('-').map((p) => (p ? capPart(p, idx === 0) : '')).join('-')
        : capPart(w, idx === 0)
    )
    .join(' ');

  if (words === '') return ''; // se esvaziou, não mantém espaço
  return hadTrailingSpace ? words + ' ' : words;
}

/** Polimento final (ao sair do campo) */
function titleCaseNameBRFinal(input: string) {
  return titleCaseNameBRLive(input).trim();
}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`w-full max-w-md rounded-xl bg-white p-5 shadow-xl ${shake ? 'animate-[shake_0.26s]' : ''}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cadastrar Paciente</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome *</label>
           <input

            value={name}
            onChange={(e) => setName(titleCaseNameBRLive(e.target.value))}
            onBlur={() => setName((v) => titleCaseNameBRFinal(v))}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Nome completo"
            required
           />

            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">CPF *</label>
            <input
              value={cpf}
              onChange={(e) => { setCPF(formatCPF(e.target.value)); if (errors.cpf) setErrors(s => ({...s, cpf: ''})); }}
              className={inputClass(!!errors.cpf)}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            {errors.cpf && <p className="mt-1 text-xs text-red-600">{errors.cpf}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              value={phone}
              onChange={(e) => { setPhone(formatBRCell(e.target.value)); if (errors.phone) setErrors(s => ({...s, phone: ''})); }}
              className={inputClass(!!errors.phone)}
              placeholder="(11) 9 9999-9999"
              inputMode="numeric"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail (opcional)</label>
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
