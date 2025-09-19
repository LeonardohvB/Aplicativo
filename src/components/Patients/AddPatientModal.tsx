// src/components/Patients/AddPatientModal.tsx
import React, { useEffect, useState } from 'react';
import { X, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Patient = {
  id: string;
  name: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
};

type NewPatient = {
  name: string;
  cpf: string;
  phone?: string;
  email?: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (p: any) => void; // devolve o paciente criado/atualizado
}

/* ----------------- helpers ----------------- */
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

// Algoritmo oficial de CPF
const isValidCPF = (cpfRaw: string) => {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;

  return d2 === parseInt(c[10], 10);
};

// Title Case PT-BR
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
/* ------------------------------------------- */

type Mode = 'create' | 'search' | 'edit';

export default function AddPatientModal({ isOpen, onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('create');
  const [editing, setEditing] = useState<Patient | null>(null);

  const [name, setName] = useState('');
  const [cpf, setCPF] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<{ name?: boolean; cpf?: boolean; phone?: boolean }>({});
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // Busca
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Patient[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    // reset ao abrir
    setMode('create');
    setEditing(null);
    setName('');
    setCPF('');
    setPhone('');
    setEmail('');
    setErrors({});
    setTouched({});
    setShake(false);
    setLoading(false);
    setQ('');
    setResults([]);
  }, [isOpen]);

  if (!isOpen) return null;

  const cpfOk = isValidCPF(cpf);

  const inputClass = (hasErr: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      hasErr
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome.';
    if (!isValidCPF(cpf)) e.cpf = 'CPF inválido.';
    const digits = onlyDigits(phone);
    if (digits && digits.length !== 11) e.phone = 'Telefone deve ter 11 dígitos.';
    return e;
  };

  const validateEdit = () => {
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

  async function searchPatients() {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const digits = onlyDigits(term);

    setSearching(true);
    try {
      // buscamos por nome (ilike) e, se houver dígitos, também por cpf contendo esses dígitos
      const nameReq = supabase
        .from('patients')
        .select('id,name,cpf,phone,email')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(20);

      const list: Patient[] = [];
      const { data: byName } = await nameReq;
      if (byName) list.push(...byName as Patient[]);

      if (digits.length >= 3) {
        const { data: byCpf } = await supabase
          .from('patients')
          .select('id,name,cpf,phone,email')
          .ilike('cpf', `%${digits}%`)
          .order('name', { ascending: true })
          .limit(20);
        if (byCpf) {
          // remove duplicados por id
          const map = new Map<string, Patient>();
          [...list, ...(byCpf as Patient[])].forEach((p) => map.set(p.id, p));
          setResults(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
          return;
        }
      }

      setResults(list);
    } finally {
      setSearching(false);
    }
  }

  function selectToEdit(p: Patient) {
    setEditing(p);
    setName(p.name || '');
    setCPF(p.cpf || '');
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setErrors({});
    setTouched({});
    setMode('edit');
  }

  const onSubmitCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, cpf: true, phone: true });

    const e = validateCreate();
    if (Object.keys(e).length) {
      setErrors(e);
      shakeNow();
      return;
    }

    setLoading(true);
    try {
      const cpfDigits = onlyDigits(cpf);

      // Pré-checagem duplicidade
      const { data: existRows } = await supabase
        .from('patients')
        .select('id')
        .eq('cpf', cpfDigits)
        .limit(1);

      if (existRows && existRows.length > 0) {
        setErrors((s) => ({ ...s, cpf: 'CPF já cadastrado.' }));
        shakeNow();
        return;
      }

      const payload: NewPatient = {
        name: name.trim(),
        cpf: cpfDigits,
        phone: onlyDigits(phone) || undefined,
        email: email.trim() || undefined,
      };

      const { data, error } = await supabase.from('patients').insert([payload]).select().single();
      if (error) {
        const msg = String(error.message || '');
        if (error.code === '23505' || /unique|duplic/i.test(msg) || /patients_cpf_key/i.test(msg)) {
          setErrors((s) => ({ ...s, cpf: 'CPF já cadastrado.' }));
          shakeNow();
          return;
        }
        setErrors((s) => ({ ...s, _global: 'Não foi possível salvar. Tente novamente.' }));
        shakeNow();
        return;
      }

      onCreated?.(data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const onSubmitEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, phone: true });

    const e = validateEdit();
    if (Object.keys(e).length) {
      setErrors(e);
      shakeNow();
      return;
    }

    if (!editing) return;

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: onlyDigits(phone) || null,
        email: email.trim() || null,
      };

      const { data, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single();

      if (error) {
        setErrors((s) => ({ ...s, _global: error.message || 'Erro ao salvar.' }));
        shakeNow();
        return;
      }

      onCreated?.(data);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {/* shake local */}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === 'edit' ? 'Editar Paciente' : 'Cadastrar Paciente'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        {/* Tabs simples */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              mode === 'create' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
            }`}
            onClick={() => {
              setMode('create');
              setEditing(null);
              setErrors({});
              setTouched({});
              setName('');
              setCPF('');
              setPhone('');
              setEmail('');
            }}
          >
            Cadastrar
          </button>
          <button
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              mode === 'search' || mode === 'edit'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
            onClick={() => {
              setMode('search');
              setEditing(null);
              setErrors({});
              setTouched({});
            }}
          >
            Buscar / Editar
          </button>
        </div>

        {/* Mensagem global */}
        {errors._global && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
            {errors._global}
          </div>
        )}

        {/* ====== MODE CREATE ====== */}
        {mode === 'create' && (
          <form onSubmit={onSubmitCreate} noValidate className="space-y-4" autoComplete="off">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome *</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(titleCaseNameBRLive(e.target.value));
                  if (errors.name) setErrors((s) => ({ ...s, name: '' }));
                }}
                onBlur={() => {
                  setTouched((t) => ({ ...t, name: true }));
                  setName((v) => titleCaseNameBRFinal(v));
                }}
                className={inputClass(!!(touched.name && errors.name))}
                aria-invalid={!!(touched.name && errors.name)}
                placeholder="Nome completo"
              />
              {touched.name && errors.name && (
                <p className="mt-1 text-xs text-red-600" aria-live="polite">
                  {errors.name}
                </p>
              )}
            </div>

            {/* CPF */}
            <div>
              <label className="block text-sm font-medium text-gray-700">CPF *</label>
              <input
                value={formatCPF(cpf)}
                onChange={(e) => {
                  setCPF(e.target.value);
                  if (errors.cpf) setErrors((s) => ({ ...s, cpf: '' }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, cpf: true }))}
                className={inputClass(!!(touched.cpf && (!cpfOk || errors.cpf)))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                aria-invalid={touched.cpf && (!cpfOk || !!errors.cpf)}
              />
              {touched.cpf && !cpfOk && !errors.cpf && (
                <p className="mt-1 text-xs text-red-600" aria-live="polite">
                  CPF inválido.
                </p>
              )}
              {errors.cpf && (
                <p className="mt-1 text-xs text-red-600" aria-live="polite">
                  {errors.cpf}
                </p>
              )}
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
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                className={inputClass(!!(touched.phone && errors.phone))}
                placeholder="(11) 9 9999-9999"
                inputMode="numeric"
              />
              {touched.phone && errors.phone && (
                <p className="mt-1 text-xs text-red-600" aria-live="polite">
                  {errors.phone}
                </p>
              )}
            </div>

            {/* E-mail */}
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
        )}

        {/* ====== MODE SEARCH / EDIT ====== */}
        {(mode === 'search' || mode === 'edit') && (
          <div className="space-y-4">
            {mode === 'search' && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchPatients())}
                      className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                      placeholder="Buscar por nome ou CPF"
                    />
                  </div>
                  <button
                    onClick={searchPatients}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={searching}
                  >
                    {searching ? 'Buscando…' : 'Buscar'}
                  </button>
                </div>

                <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
                  {results.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">Nenhum resultado</div>
                  ) : (
                    results.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectToEdit(p)}
                        className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          CPF: {formatCPF(p.cpf)} {p.phone ? `• Tel: ${formatBRCell(p.phone)}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {mode === 'edit' && (
              <form onSubmit={onSubmitEdit} noValidate className="space-y-4" autoComplete="off">
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

                {/* CPF bloqueado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF</label>
                  <input
                    value={formatCPF(cpf)}
                    disabled
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">O CPF é único e não pode ser alterado.</p>
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
                  <button type="button" onClick={() => setMode('search')} className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50">
                    Voltar
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
