import React, { useEffect, useState, useRef } from 'react';
import { X, Search, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Patient = {
  id: string;
  name: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
  birth_date?: string | null; // ISO YYYY-MM-DD
};

type NewPatient = {
  name: string;
  cpf: string;
  phone: string;           // obrigatório no create
  email?: string;
  birth_date?: string;     // ISO YYYY-MM-DD
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (p: any) => void;
};

/* ===== Helpers ===== */
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

// Data BR: "DD/MM/AAAA"
const formatBRDate = (v: string) => {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};
const isValidBRDate = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return false;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const yyyy = parseInt(m[3], 10);
  if (mm < 1 || mm > 12) return false;
  const maxDay = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDay) return false;
  return true;
};
const brDateToISO = (s: string): string | null => {
  if (!isValidBRDate(s)) return null;
  const [dd, mm, yyyy] = s.split('/');
  return `${yyyy}-${mm}-${dd}`;
};
const isoToBRDate = (iso?: string | null): string => {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
};

// Validação de CPF
const isValidCPF = (cpfRaw: string) => {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
};

// Title Case PT-BR
const LOWERCASE_WORDS = new Set(['de','da','do','das','dos','e']);
function capPart(part: string, forceCap: boolean) {
  if (!forceCap && LOWERCASE_WORDS.has(part)) return part;
  return part.charAt(0).toUpperCase() + part.slice(1);
}
function titleCaseNameBRLive(input: string) {
  if (!input) return '';
  const hadTrailing = /\s$/.test(input);
  const core = input.toLowerCase().replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
  const words = core.split(' ').filter(Boolean).map((w, i) =>
    w.includes('-')
      ? w.split('-').map((p, j) => capPart(p, i === 0 || j > 0)).join('-')
      : capPart(w, i === 0)
  );
  const out = words.join(' ');
  return hadTrailing ? out + ' ' : out;
}
function titleCaseNameBRFinal(input: string) { return titleCaseNameBRLive(input).trim(); }

export default function AddPatientModal({ isOpen, onClose, onCreated }: Props) {
  // ---- HOOKS (ordem fixa) ----
  const [mode, setMode] = useState<'create' | 'search' | 'edit'>('create');

  const [editing, setEditing] = useState<Patient | null>(null);
  const [name, setName] = useState('');
  const [cpf, setCPF] = useState('');              // dígitos
  const [birthDate, setBirthDate] = useState('');  // DD/MM/AAAA
  const [phone, setPhone] = useState('');          // dígitos
  const [email, setEmail] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Patient[]>([]);

  const [cpfCheckLoading, setCpfCheckLoading] = useState(false);
  const cpfTimer = useRef<number | null>(null);

  // ⚠️ sem useEffect de busca: só um timer ref
  const searchTimer = useRef<number | null>(null);

  // reset ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setMode('create');
    setEditing(null);
    setName('');
    setCPF('');
    setBirthDate('');
    setPhone('');
    setEmail('');
    setErrors({});
    setTouched({});
    setShake(false);
    setLoading(false);
    setQ('');
    setResults([]);
  }, [isOpen]);

  // limpar timers no unmount
  useEffect(() => {
    return () => {
      if (cpfTimer.current) window.clearTimeout(cpfTimer.current);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  // ✅ return condicional só depois dos hooks
  if (!isOpen) return null;

  const cpfOk = isValidCPF(cpf);
  const phoneOk = onlyDigits(phone).length === 11;
  const birthOk = isValidBRDate(birthDate);

  const inputClass = (bad: boolean) =>
    `w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
      bad ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
          : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  // validações do Create
  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome.';
    if (!cpfOk) e.cpf = 'CPF inválido.';
    if (!birthOk) e.birthDate = 'Data de nascimento obrigatória (DD/MM/AAAA).';
    if (!phoneOk) e.phone = 'Telefone obrigatório.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido.';
    return e;
  };

  const shakeNow = () => { setShake(true); setTimeout(() => setShake(false), 260); };

  const onSubmitCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, cpf: true, phone: true, birthDate: true });

    const e = validateCreate();
    if (Object.keys(e).length) { setErrors(e); shakeNow(); return; }

    setLoading(true);
    try {
      const cpfDigits = cpf;

      // pré-checagem duplicidade
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
        phone: onlyDigits(phone),
        email: email.trim() || undefined,
        birth_date: brDateToISO(birthDate) || undefined,
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
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'E-mail inválido.';
    if (Object.keys(e).length) { setErrors(e); shakeNow(); return; }
    if (!editing) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .update({
          name: name.trim(),
          phone: onlyDigits(phone) || null,
          email: email.trim() || null,
          birth_date: brDateToISO(birthDate),
        })
        .eq('id', editing.id)
        .select()
        .single();
      if (error) { setErrors((s) => ({ ...s, _global: 'Não foi possível salvar. Tente novamente.' })); shakeNow(); return; }
      onCreated?.(data);
      setMode('search'); setEditing(null);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    const ok = window.confirm('Excluir este paciente? Esta ação não pode ser desfeita.');
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('patients').delete().eq('id', editing.id);
      if (error) {
        setErrors((s) => ({
          ...s,
          _global:
            'Não foi possível excluir. Este paciente pode estar vinculado a atendimentos. Remova os vínculos e tente novamente.'
        }));
        shakeNow();
        return;
      }
      setResults((r) => r.filter((x) => x.id !== editing.id));
      setMode('search');
      setEditing(null);
    } finally {
      setLoading(false);
    }
  };

  // ===== Busca em tempo real sem hook (debounce via ref) =====
  const runSearch = async (query: string) => {
    const txt = query.trim();
    const digits = onlyDigits(query);

    if (txt.length < 2 && digits.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const orParts = [`name.ilike.%${txt}%`];
      if (digits) orParts.push(`cpf.ilike.%${digits}%`);

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .or(orParts.join(','))
        .order('name')
        .limit(50);
      if (error) throw error;
      setResults(data || []);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (value: string) => {
    setQ(value);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => runSearch(value), 280);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`w-full max-w-md rounded-xl bg-white p-6 ${shake ? 'animate-shake' : ''}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Cadastrar Paciente' : mode === 'search' ? 'Buscar / Editar Paciente' : 'Editar Paciente'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Esconde abas no modo EDIT */}
        {mode !== 'edit' && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              className={`rounded-lg px-4 py-2 ${mode === 'create' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => setMode('create')}
            >
              Cadastrar
            </button>
            <button
              className={`rounded-lg px-4 py-2 ${mode === 'search' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              onClick={() => setMode('search')}
            >
              Buscar / Editar
            </button>
          </div>
        )}

        {errors._global && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
            {errors._global}
          </div>
        )}

        {/* ===== CREATE ===== */}
        {mode === 'create' && (
          <form onSubmit={onSubmitCreate} noValidate className="space-y-4" autoComplete="off">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome *</label>
              <input
                value={name}
                onChange={(e) => { setName(titleCaseNameBRLive(e.target.value)); if (errors.name) setErrors(s => ({...s, name: ''})); }}
                onBlur={() => { setTouched(t => ({...t, name: true})); setName(v => titleCaseNameBRFinal(v)); }}
                className={inputClass(!!(touched.name && errors.name))}
                aria-invalid={!!(touched.name && errors.name)}
                placeholder="Nome completo"
              />
              {touched.name && errors.name && <p className="mt-1 text-xs text-red-600">Informe o nome.</p>}
            </div>

            {/* CPF */}
            <div>
              <label className="block text-sm font-medium text-gray-700">CPF *</label>
              <input
                value={formatCPF(cpf)}
                onChange={(e) => {
                  const digits = onlyDigits(e.target.value).slice(0, 11);
                  setCPF(digits);
                  if (errors.cpf) setErrors(s => ({...s, cpf: ''}));

                  if (cpfTimer.current) window.clearTimeout(cpfTimer.current);
                  cpfTimer.current = window.setTimeout(async () => {
                    if (mode !== 'create') return;
                    if (digits.length === 11 && isValidCPF(digits)) {
                      try {
                        setCpfCheckLoading(true);
                        const { data } = await supabase.from('patients').select('id').eq('cpf', digits).limit(1);
                        const exists = Array.isArray(data) && data.length > 0;
                        setErrors(s => ({ ...s, cpf: exists ? 'CPF já cadastrado.' : '' }));
                      } finally { setCpfCheckLoading(false); }
                    }
                  }, 350);
                }}
                maxLength={14}
                className={inputClass(!!(touched.cpf && (!cpfOk || !!errors.cpf)))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                aria-invalid={touched.cpf && (!cpfOk || !!errors.cpf)}
                onBlur={() => setTouched(t => ({...t, cpf: true}))}
              />
              {touched.cpf && !cpfOk && !errors.cpf && <p className="mt-1 text-xs text-red-600">CPF inválido.</p>}
              {errors.cpf && <p className="mt-1 text-xs text-red-600">{errors.cpf}</p>}
              {cpfCheckLoading && !errors.cpf && cpf.length === 11 && cpfOk && (
                <p className="mt-1 text-xs text-gray-500">Verificando CPF…</p>
              )}
            </div>

            {/* Data de Nascimento — OBRIGATÓRIA */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Nascimento *</label>
              <input
                value={formatBRDate(birthDate)}
                onChange={(e) => {
                  setBirthDate(formatBRDate(e.target.value));
                  if (errors.birthDate) setErrors(s => ({ ...s, birthDate: '' }));
                }}
                onBlur={() => setTouched(t => ({ ...t, birthDate: true }))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                aria-invalid={!!(touched.birthDate && errors.birthDate)}
                className={`${inputClass(!!(touched.birthDate && errors.birthDate))} ${(shake && errors.birthDate) ? 'animate-input-shake' : ''}`}
              />
              {touched.birthDate && errors.birthDate && (
                <p className="mt-1 text-xs text-red-600">{errors.birthDate}</p>
              )}
            </div>

            {/* Telefone — OBRIGATÓRIO */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone *</label>
              <input
                value={formatBRCell(phone)}
                onChange={(e) => { setPhone(onlyDigits(e.target.value).slice(0,11)); if (errors.phone) setErrors(s => ({...s, phone: ''})); }}
                className={inputClass(!!(touched.phone && (!phoneOk || !!errors.phone)))}
                aria-invalid={touched.phone && (!phoneOk || !!errors.phone)}
                placeholder="(11) 9 9999-9999"
                inputMode="numeric"
                maxLength={17}
                onBlur={() => setTouched(t => ({...t, phone: true}))}
              />
              {touched.phone && !phoneOk && <p className="mt-1 text-xs text-red-600">Telefone obrigatório.</p>}
            </div>

            {/* E-mail (opcional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail (opcional)</label>
              <input
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({...s, email: ''})); }}
                className={inputClass(!!errors.email)}
                aria-invalid={!!errors.email}
                placeholder="email@exemplo.com"
                type="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
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

        {/* ===== SEARCH / EDIT ===== */}
        {(mode === 'search' || mode === 'edit') && (
          <div className="space-y-4">
            {mode === 'search' && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={q}
                    onChange={(e) => onQueryChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-9 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Buscar por nome ou CPF"
                  />
                </div>

                {searching && <p className="text-sm text-gray-500">Buscando…</p>}

                <ul className="divide-y divide-gray-100 rounded-lg border">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50"
                      onClick={() => {
                        setEditing(p);
                        setName(p.name);
                        setCPF(p.cpf);
                        setPhone(p.phone || '');
                        setEmail(p.email || '');
                        setBirthDate(isoToBRDate(p.birth_date));
                        setErrors({});
                        setTouched({});
                        setMode('edit');
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.currentTarget as any).click()}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">
                          {formatCPF(p.cpf)} {p.phone ? `· ${formatBRCell(p.phone)}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                  {results.length === 0 && !searching && (
                    <li className="px-3 py-4 text-sm text-gray-500">
                      {q.trim().length === 0 ? 'Digite para buscar.' : 'Nenhum resultado.'}
                    </li>
                  )}
                </ul>
              </>
            )}

            {mode === 'edit' && editing && (
              <form onSubmit={onSubmitEdit} className="space-y-4" noValidate>
                {/* CPF (somente leitura) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">CPF</label>
                  <input
                    value={formatCPF(editing.cpf)}
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-600"
                  />
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(titleCaseNameBRLive(e.target.value))}
                    onBlur={() => setName((v) => titleCaseNameBRFinal(v))}
                    className={inputClass(!!errors.name)}
                    aria-invalid={!!errors.name}
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefone</label>
                  <input
                    value={formatBRCell(phone)}
                    onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0,11))}
                    className={inputClass(!!errors.phone)}
                    aria-invalid={!!errors.phone}
                    inputMode="numeric"
                    maxLength={17}
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
                </div>

                {/* Data de Nascimento (editar) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                  <input
                    value={formatBRDate(birthDate)}
                    onChange={(e) => setBirthDate(formatBRDate(e.target.value))}
                    placeholder="DD/MM/AAAA"
                    inputMode="numeric"
                    maxLength={10}
                    className={inputClass(false)}
                  />
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-mail (opcional)</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass(!!errors.email)}
                    aria-invalid={!!errors.email}
                    type="email"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => { setMode('search'); setEditing(null); }}
                    className="rounded-lg border px-4 py-2 hover:bg-gray-50"
                  >
                    Voltar
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      title="Excluir paciente"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {loading ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Shake apenas no input quando houver erro (sem mexer no Tailwind config) */}
      <style>{`
        @keyframes input-shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          50% { transform: translateX(2px); }
          75% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
        }
        .animate-input-shake { animation: input-shake 0.2s linear 1; }
      `}</style>
    </div>
  );
}
