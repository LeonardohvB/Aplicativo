// src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  CreditCard,
  Save,
  LogOut,
} from "lucide-react";

/* -------------------- Helpers locais -------------------- */
// Somente dígitos
const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

// (11) 9 9999-9999
const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

// 000.000.000-00
const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

// Validação de CPF
const isValidCPF = (cpfRaw: string) => {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
};

// Title Case para TODAS as palavras (preserva hífen e apóstrofo)
const capSingle = (w: string) => {
  if (!w) return "";
  const ap = w.match(/^([a-z])'([a-z].*)$/i);
  if (ap) {
    const head = ap[1].toUpperCase();
    const rest = (ap[2][0]?.toUpperCase() || "") + ap[2].slice(1).toLowerCase();
    return `${head}'${rest}`;
  }
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
};
const titleAllWordsLive = (input: string) => {
  if (!input) return "";
  if (/^\s+$/.test(input)) return "";
  const hadTrailing = /\s$/.test(input);
  const core = input.toLowerCase().replace(/\s{2,}/g, " ").replace(/^\s+/, "");
  const words = core
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.includes("-") ? w.split("-").map(capSingle).join("-") : capSingle(w)))
    .join(" ");
  return words ? (hadTrailing ? words + " " : words) : "";
};
const titleAllWordsFinal = (input: string) => titleAllWordsLive(input).trim();
/* -------------------------------------------------------- */

type ProfileProps = { onBack: () => void };

type ProfileForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
};

export default function Profile({ onBack }: ProfileProps) {
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    cpf: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; cpf?: string; phone?: string }>({});

  // carrega o perfil do usuário logado
  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("name, cpf, phone, email")
          .eq("id", uid)
          .single();

        if (error && error.code !== "PGRST116") {
          console.warn("fetch profile error:", error);
        }

        if (alive) {
          setForm({
            name: titleAllWordsFinal(data?.name ?? ""),
            cpf: formatCPF(data?.cpf ?? ""),
            phone: formatBRCell(data?.phone ?? ""),
            email: data?.email ?? auth.user?.email ?? "",
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const inputClass = (hasErr?: boolean) =>
    `w-full pr-3 pl-9 py-2 rounded-xl border bg-white text-gray-900 focus:outline-none focus:ring-2 ${
      hasErr
        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
        : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
    }`;

  const onChange =
    (field: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setErrors((s) => ({ ...s, [field]: undefined }));

      if (field === "name") {
        setForm((f) => ({ ...f, name: titleAllWordsLive(v) }));
      } else if (field === "cpf") {
        setForm((f) => ({ ...f, cpf: formatCPF(v) }));
      } else if (field === "phone") {
        setForm((f) => ({ ...f, phone: formatBRCell(v) }));
      } else {
        setForm((f) => ({ ...f, [field]: v }));
      }
    };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Informe o nome completo.";
    if (form.cpf && !isValidCPF(form.cpf)) e.cpf = "CPF inválido.";
    const d = onlyDigits(form.phone);
    if (d && d.length !== 11) e.phone = "Telefone deve ter 11 dígitos.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const payload = {
        id: uid,
        name: titleAllWordsFinal(form.name) || null,
        cpf: onlyDigits(form.cpf) || null,
        phone: onlyDigits(form.phone) || null,
        email: form.email?.trim() || null,
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      window.dispatchEvent(new CustomEvent("profile:saved", { detail: { name: payload.name || "" } }));
      alert("Perfil atualizado com sucesso!");
    } catch (e: any) {
      console.error("save profile error:", e);
      alert(e.message ?? "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm("Deseja realmente encerrar a sessão?")) return;
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: any) {
      console.error("signOut error:", e);
      alert(e.message ?? "Erro ao sair");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* topo com voltar + título */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>
        <div className="w-[64px]" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        {/* Nome */}
        <label className="block text-sm text-gray-600 mb-1">Nome completo</label>
        <div className="relative mb-1">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ex.: Maria Clara D'Ávila"
            value={form.name}
            onChange={onChange("name")}
            onBlur={() => setForm((f) => ({ ...f, name: titleAllWordsFinal(f.name) }))}
            className={inputClass(!!errors.name)}
            disabled={loading || saving}
          />
        </div>
        {errors.name && <p className="mb-3 text-xs text-red-600">{errors.name}</p>}

        {/* CPF */}
        <label className="block text-sm text-gray-600 mb-1">CPF</label>
        <div className="relative mb-1">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={onChange("cpf")}
            className={inputClass(!!errors.cpf)}
            disabled={loading || saving}
          />
        </div>
        {errors.cpf && <p className="mb-3 text-xs text-red-600">{errors.cpf}</p>}

        {/* Telefone */}
        <label className="block text-sm text-gray-600 mb-1">Telefone</label>
        <div className="relative mb-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            inputMode="numeric"
            placeholder="(11) 9 9999-9999"
            value={form.phone}
            onChange={onChange("phone")}
            className={inputClass(!!errors.phone)}
            disabled={loading || saving}
          />
        </div>
        {errors.phone && <p className="mb-3 text-xs text-red-600">{errors.phone}</p>}

        {/* Email */}
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <div className="relative mb-5">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            placeholder="voce@email.com"
            value={form.email}
            onChange={onChange("email")}
            className={inputClass()}
            disabled={loading || saving}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading || saving}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white ${
            saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
          title="Salvar"
        >
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </button>

        {/* Botão Encerrar sessão */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
          title="Encerrar sessão"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? "Saindo..." : "Encerrar sessão"}
        </button>
      </div>
    </div>
  );
}
