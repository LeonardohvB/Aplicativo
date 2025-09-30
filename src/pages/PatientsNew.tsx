import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Search, Trash2 , ChevronLeft } from "lucide-react";


/* ==================== Tipos ==================== */
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
  phone: string;         // obrigatório no create
  email?: string;
  birth_date?: string;   // ISO YYYY-MM-DD
};

type Props = {
  onBack: () => void;               // volta para a tela anterior (ex: Agenda)
  onCreated?: (p: any) => void;     // avisa criação/edição/remoção
};

/* ==================== Helpers (copiados do modal) ==================== */
const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return "";
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
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  if (mm < 1 || mm > 12) return false;
  const maxDay = new Date(yyyy, mm, 0).getDate();
  return dd >= 1 && dd <= maxDay;
};
const brDateToISO = (s: string): string | null => {
  if (!isValidBRDate(s)) return null;
  const [dd, mm, yyyy] = s.split("/");
  return `${yyyy}-${mm}-${dd}`;
};
const isoToBRDate = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
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

// Title case pt-BR
const LOWER = new Set(["de", "da", "do", "das", "dos", "e"]);
const cap = (w: string, force: boolean) =>
  force || !LOWER.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
const titleLive = (s: string) => {
  if (!s) return "";
  const trailing = /\s$/.test(s);
  const words = s
    .toLowerCase()
    .replace(/\s{2,}/g, " ")
    .trimStart()
    .split(" ")
    .filter(Boolean)
    .map((w, i) =>
      w.includes("-")
        ? w.split("-").map((p, j) => cap(p, i === 0 || j > 0)).join("-")
        : cap(w, i === 0)
    );
  const out = words.join(" ");
  return trailing ? out + " " : out;
};
const titleFinal = (s: string) => titleLive(s).trim();

/* =========================== Página =========================== */
export default function PatientsNew({ onBack, onCreated }: Props) {
  type Mode = "create" | "search" | "edit" | "list" | "view";
  const [mode, setMode] = useState<Mode>("create");

  // edição/visualização
  const [editing, setEditing] = useState<Patient | null>(null);
  const [viewing, setViewing] = useState<Patient | null>(null);

  // formulário
  const [name, setName] = useState("");
  const [cpf, setCPF] = useState("");              // dígitos
  const [birthDate, setBirthDate] = useState("");  // DD/MM/AAAA
  const [phone, setPhone] = useState("");          // dígitos
  const [email, setEmail] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  // busca/lista
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Patient[]>([]);
  const [listCount, setListCount] = useState<number | null>(null);

  const cpfTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  // preserva scroll da Lista
  const listBoxRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<number>(0);
  const editOriginRef = useRef<"view" | "search" | null>(null);

  // ===== efeitos (equivalentes ao onOpen do modal) =====
  useEffect(() => {
    // ao entrar na página, zera estados como no modal ao abrir
    setMode("create");
    setEditing(null);
    setViewing(null);
    setName(""); setCPF(""); setBirthDate(""); setPhone(""); setEmail("");
    setErrors({}); setTouched({}); setShake(false); setLoading(false);
    setQ(""); setResults([]); setListCount(null);
    listScrollRef.current = 0;
  }, []); // uma vez ao montar

  useEffect(() => {
    return () => {
      if (cpfTimer.current) window.clearTimeout(cpfTimer.current);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  // carregar lista completa quando entrar na aba "list"
  useEffect(() => {
    if (mode !== "list") return;
    (async () => {
      setSearching(true);
      try {
        const { data, error, count } = await supabase
          .from("patients")
          .select("*", { count: "exact" })
          .order("name", { ascending: true });
        if (error) throw error;
        setResults(data || []);
        setListCount(count ?? (data?.length ?? 0));
        // restaurar scroll
        requestAnimationFrame(() => {
          if (listBoxRef.current) listBoxRef.current.scrollTop = listScrollRef.current || 0;
        });
      } finally {
        setSearching(false);
      }
    })();
  }, [mode]);

  const cpfOk = isValidCPF(cpf);
  const phoneOk = onlyDigits(phone).length === 11;
  const birthOk = isValidBRDate(birthDate);

  const inputClass = (bad: boolean) =>
    `w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
      bad ? "border-red-400 focus:border-red-500 focus:ring-red-200"
          : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
    }`;

  const validateCreate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Informe o nome.";
    if (!cpfOk) e.cpf = "CPF inválido.";
    if (!birthOk) e.birthDate = "Data de nascimento obrigatória (DD/MM/AAAA).";
    if (!phoneOk) e.phone = "Telefone obrigatório.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido.";
    return e;
  };

  const shakeNow = () => { setShake(true); setTimeout(() => setShake(false), 260); };

  /* =============== CREATE =============== */
  const onSubmitCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, cpf: true, phone: true, birthDate: true });

    const e = validateCreate();
    if (Object.keys(e).length) { setErrors(e); shakeNow(); return; }

    setLoading(true);
    try {
      const cpfDigits = cpf;

      // checa duplicidade
      const { data: exist } = await supabase.from("patients").select("id").eq("cpf", cpfDigits).limit(1);
      if (exist && exist.length > 0) {
        setErrors((s) => ({ ...s, cpf: "CPF já cadastrado." }));
        shakeNow(); return;
      }

      const payload: NewPatient = {
        name: titleFinal(name),
        cpf: cpfDigits,
        phone: onlyDigits(phone),
        email: email.trim() || undefined,
        birth_date: brDateToISO(birthDate) || undefined,
      };

      const { data, error } = await supabase.from("patients").insert([payload]).select().single();
      if (error) throw error;

      onCreated?.(data);
      onBack(); // volta após criar
    } catch {
      setErrors((s) => ({ ...s, _global: "Não foi possível salvar. Tente novamente." }));
      shakeNow();
    } finally {
      setLoading(false);
    }
  };

  /* =============== EDIT =============== */
  const onSubmitEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Informe o nome.";
    if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) e.email = "E-mail inválido.";
    if (Object.keys(e).length) { setErrors(e); shakeNow(); return; }
    if (!editing) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .update({
          name: titleFinal(name),
          phone: onlyDigits(phone) || null,
          email: email.trim() || null,
          birth_date: brDateToISO(birthDate),
        })
        .eq("id", editing.id)
        .select()
        .single();

      if (error) throw error;

      onCreated?.(data);
      // atualiza item em memória (lista e view)
      setResults((rs) => rs.map((r) => (r.id === data.id ? data : r)));
      setViewing((v) => (v && v.id === data.id ? data : v));
      // volta para o view se veio dele; senão volta para busca
      if (editOriginRef.current === "view") {
        setEditing(null);
        setMode("view");
      } else {
        setEditing(null);
        setMode("search");
      }
    } catch {
      setErrors((s) => ({ ...s, _global: "Não foi possível salvar. Tente novamente." }));
      shakeNow();
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!editing) return;
    const ok = window.confirm("Excluir este paciente? Esta ação não pode ser desfeita.");
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("patients").delete().eq("id", editing.id);
      if (error) throw error;
      setResults((r) => r.filter((x) => x.id !== editing.id));
      setEditing(null);
      setMode("list"); // após excluir, volta para lista (mantendo scroll)
      onCreated?.(null);
    } catch {
      setErrors((s) => ({
        ...s,
        _global:
          "Não foi possível excluir. Este paciente pode estar vinculado a atendimentos. Remova os vínculos e tente novamente.",
      }));
      shakeNow();
    } finally {
      setLoading(false);
    }
  };

  /* =============== SEARCH (com debounce) =============== */
  const runSearch = async (query: string) => {
    const txt = query.trim();
    const digits = onlyDigits(query);

    if (txt.length < 2 && digits.length < 3) {
      setResults([]); setSearching(false); return;
    }

    setSearching(true);
    try {
      const orParts = [`name.ilike.%${txt}%`];
      if (digits) orParts.push(`cpf.ilike.%${digits}%`);

      const { data } = await supabase
        .from("patients")
        .select("*")
        .or(orParts.join(","))
        .order("name")
        .limit(50);
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

  /* ==================== Render (full-screen) ==================== */
  return (
    <div className="min-h-screen bg-white flex flex-col animate-[pageIn_.22s_ease-out]">

      {/* Cabeçalho fixo */}
      <header className="sticky top-0 z-10 bg-white border-b">
  {/* Linha 1: Voltar (esq) + Título central */}
  <div className="relative px-3 py-3 flex items-center justify-center">
    {/* Botão Voltar alinhado à esquerda */}
    <button
      onClick={onBack}
      className="absolute left-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-blue-700 hover:bg-blue-50 active:scale-[0.98] transition"
      aria-label="Voltar"
    >
      <ChevronLeft className="h-5 w-5" />
      <span className="font-medium">Voltar</span>
    </button>

    {/* Título central (muda conforme o modo) */}
    <h1 className="text-base sm:text-lg font-semibold text-slate-900">
      {mode === "create" && "Cadastrar Paciente"}
      {mode === "search" && "Buscar / Editar Paciente"}
      {mode === "list"   && "Lista de Pacientes"}
      {mode === "view"   && "Informações do Paciente"}
      {mode === "edit"   && "Editar Paciente"}
    </h1>
  </div>

  {/* Linha 2: Abas (somem em view/edit) — visíveis só em telas >= sm */}
  {mode !== "edit" && mode !== "view" && (
    <div className="px-3 pb-3 hidden sm:flex gap-2 flex-wrap">
      <button
        className={`px-3 py-2 rounded-lg ${mode === "create" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
        onClick={() => setMode("create")}
      >
        Cadastrar
      </button>
      <button
        className={`px-3 py-2 rounded-lg ${mode === "search" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
        onClick={() => setMode("search")}
      >
        Buscar / Editar
      </button>
      <button
        className={`px-3 py-2 rounded-lg ${mode === "list" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
        onClick={() => setMode("list")}
      >
        Lista
      </button>
    </div>
  )}
</header>

      {/* Abinhas em telas pequenas (mobile) */}
      {mode !== "edit" && mode !== "view" && (
        <div className="sm:hidden p-3 border-b flex gap-2">
          <button
            className={`px-3 py-2 rounded-lg ${mode === "create" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
            onClick={() => setMode("create")}
          >
            Cadastrar
          </button>
          <button
            className={`px-3 py-2 rounded-lg ${mode === "search" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
            onClick={() => setMode("search")}
          >
            Buscar / Editar
          </button>
          <button
            className={`px-3 py-2 rounded-lg ${mode === "list" ? "bg-blue-600 text-white" : "border hover:bg-slate-50"}`}
            onClick={() => setMode("list")}
          >
            Lista
          </button>
        </div>
      )}

      {/* Erro global */}
      {errors._global && (
        <div className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" aria-live="polite">
          {errors._global}
        </div>
      )}

      {/* Conteúdo */}
      <div className={`flex-1 overflow-y-auto p-4 ${shake ? "animate-input-shake" : ""}`}>
        {/* CREATE */}
        {mode === "create" && (
          <form onSubmit={onSubmitCreate} noValidate className="space-y-4" autoComplete="off">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome *</label>
              <input
                value={name}
                onChange={(e) => { setName(titleLive(e.target.value)); if (errors.name) setErrors(s => ({...s, name: ""})); }}
                onBlur={() => { setTouched(t => ({...t, name: true})); setName(v => titleFinal(v)); }}
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
                  if (errors.cpf) setErrors(s => ({...s, cpf: ""}));
                  if (cpfTimer.current) window.clearTimeout(cpfTimer.current);
                  cpfTimer.current = window.setTimeout(async () => {
                    if (digits.length === 11 && isValidCPF(digits)) {
                      const { data } = await supabase.from("patients").select("id").eq("cpf", digits).limit(1);
                      const exists = Array.isArray(data) && data.length > 0;
                      setErrors(s => ({ ...s, cpf: exists ? "CPF já cadastrado." : "" }));
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
            </div>

            {/* Data de Nascimento — OBRIGATÓRIA */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Nascimento *</label>
              <input
                value={formatBRDate(birthDate)}
                onChange={(e) => { setBirthDate(formatBRDate(e.target.value)); if (errors.birthDate) setErrors(s => ({...s, birthDate: ""})); }}
                onBlur={() => setTouched(t => ({...t, birthDate: true}))}
                placeholder="DD/MM/AAAA"
                inputMode="numeric"
                maxLength={10}
                aria-invalid={!!(touched.birthDate && errors.birthDate)}
                className={inputClass(!!(touched.birthDate && errors.birthDate))}
              />
              {touched.birthDate && errors.birthDate && <p className="mt-1 text-xs text-red-600">{errors.birthDate}</p>}
            </div>

            {/* Telefone — OBRIGATÓRIO */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone *</label>
              <input
                value={formatBRCell(phone)}
                onChange={(e) => { setPhone(onlyDigits(e.target.value).slice(0,11)); if (errors.phone) setErrors(s => ({...s, phone: ""})); }}
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
                onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(s => ({...s, email: ""})); }}
                className={inputClass(!!errors.email)}
                aria-invalid={!!errors.email}
                placeholder="email@exemplo.com"
                type="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onBack} className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">
                {loading ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        )}

        {/* SEARCH */}
        {mode === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
                  className="cursor-pointer px-3 py-2 hover:bg-gray-50"
                  onClick={() => {
                    editOriginRef.current = "search";
                    setEditing(p);
                    setName(p.name);
                    setCPF(p.cpf);
                    setPhone(p.phone || "");
                    setEmail(p.email || "");
                    setBirthDate(isoToBRDate(p.birth_date));
                    setErrors({});
                    setMode("edit");
                  }}
                >
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatCPF(p.cpf)} {p.phone ? `· ${formatBRCell(p.phone)}` : ""}
                  </div>
                </li>
              ))}
              {results.length === 0 && !searching && (
                <li className="px-3 py-4 text-sm text-gray-500">
                  {q.trim().length === 0 ? "Digite para buscar." : "Nenhum resultado."}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* LISTA */}
        {mode === "list" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Pacientes cadastrados</span>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1 text-xs text-gray-700">
                {typeof listCount === "number" ? listCount : "—"}
              </span>
            </div>

            <div ref={listBoxRef} className="max-h-[60vh] overflow-y-auto rounded-lg border">
              <ul className="divide-y divide-gray-100">
                {results.map((p) => (
                  <li
                    key={p.id}
                    className="cursor-pointer px-3 py-3 hover:bg-gray-50"
                    onClick={() => {
                      // guarda scroll e abre modo de visualização
                      listScrollRef.current = listBoxRef.current?.scrollTop || 0;
                      setViewing(p);
                      setMode("view");
                    }}
                  >
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatCPF(p.cpf)} {p.phone ? ` · ${formatBRCell(p.phone)}` : ""}
                    </div>
                  </li>
                ))}
                {results.length === 0 && (
                  <li className="px-3 py-4 text-sm text-gray-500">Nenhum paciente cadastrado.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* VIEW */}
        {mode === "view" && viewing && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">{viewing.name}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CPF</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">{formatCPF(viewing.cpf)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Telefone</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                {viewing.phone ? formatBRCell(viewing.phone) : "—"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                {isoToBRDate(viewing.birth_date) || "—"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                {viewing.email || "—"}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => { setMode("list"); /* scroll restaura via ref */ }}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => {
                  editOriginRef.current = "view";
                  setEditing(viewing);
                  setName(viewing.name);
                  setCPF(viewing.cpf);
                  setPhone(viewing.phone || "");
                  setEmail(viewing.email || "");
                  setBirthDate(isoToBRDate(viewing.birth_date));
                  setErrors({});
                  setMode("edit");
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Editar
              </button>
            </div>
          </div>
        )}

        {/* EDIT */}
        {mode === "edit" && editing && (
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
                onChange={(e) => setName(titleLive(e.target.value))}
                onBlur={() => setName((v) => titleFinal(v))}
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

            {/* Data de Nascimento */}
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
                onClick={() => {
                  if (editOriginRef.current === "view") setMode("view");
                  else setMode("search");
                  setEditing(null);
                }}
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
                  {loading ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* animação leve para inputs com erro */}
      <style>{`
  /* Animação de entrada da página */
  @keyframes pageIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* (opcional) se quiser vir da direita em vez de baixo:
  @keyframes pageIn {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  } */

  /* Você já tinha esta aqui para chacoalhar inputs com erro */
  @keyframes input-shake {
    0% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    50% { transform: translateX(2px); }
    75% { transform: translateX(-2px); }
    100% { transform: translateX(0); }
  }
  .animate-input-shake { animation: input-shake .2s linear 1; }
`}</style>

    </div>
  );
}
