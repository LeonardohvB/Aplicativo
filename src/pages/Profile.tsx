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

type ProfileProps = {
  // usado pelo botão "Voltar" (volta para o Dashboard)
  onBack: () => void;
};

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
          // PGRST116 = not found (ainda não tem row) — tudo bem
          console.warn("fetch profile error:", error);
        }

        if (alive && data) {
          setForm({
            name: data.name ?? "",
            cpf: data.cpf ?? "",
            phone: data.phone ?? "",
            email: data.email ?? auth.user?.email ?? "",
          });
        } else if (alive) {
          // sem row ainda: pré-preenche apenas email do auth
          setForm((f) => ({
            ...f,
            email: auth.user?.email ?? "",
          }));
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

  const onChange =
    (field: keyof ProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const { error } = await supabase.from("profiles").upsert(
        {
          id: uid,
          name: form.name?.trim() || null,
          cpf: form.cpf?.trim() || null,
          phone: form.phone?.trim() || null,
          email: form.email?.trim() || null,
        },
        { onConflict: "id" }
      );

      if (error) throw error;

      // avisa o app para atualizar o “Seja bem-vindo”
      window.dispatchEvent(
        new CustomEvent("profile:saved", {
          detail: { name: form.name || "" },
        })
      );

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
      // App.tsx já cuida de mandar para Login quando o usuário for null
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
        <div className="w-[64px]" /> {/* espaçador simétrico */}
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        {/* Nome */}
        <label className="block text-sm text-gray-600 mb-1">
          Nome completo
        </label>
        <div className="relative mb-4">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Ex.: Maria Silva"
            value={form.name}
            onChange={onChange("name")}
            className="w-full pr-3 pl-9 py-2 rounded-xl border border-gray-200 bg-white text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || saving}
          />
        </div>

        {/* CPF */}
        <label className="block text-sm text-gray-600 mb-1">CPF</label>
        <div className="relative mb-4">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={onChange("cpf")}
            className="w-full pr-3 pl-9 py-2 rounded-xl border border-gray-200 bg-white text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || saving}
          />
        </div>

        {/* Telefone */}
        <label className="block text-sm text-gray-600 mb-1">Telefone</label>
        <div className="relative mb-4">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="tel"
            placeholder="(00) 00000-0000"
            value={form.phone}
            onChange={onChange("phone")}
            className="w-full pr-3 pl-9 py-2 rounded-xl border border-gray-200 bg-white text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || saving}
          />
        </div>

        {/* Email */}
        <label className="block text-sm text-gray-600 mb-1">Email</label>
        <div className="relative mb-5">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            placeholder="voce@email.com"
            value={form.email}
            onChange={onChange("email")}
            className="w-full pr-3 pl-9 py-2 rounded-xl border border-gray-200 bg-white text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || saving}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading || saving}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white
            ${saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
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
