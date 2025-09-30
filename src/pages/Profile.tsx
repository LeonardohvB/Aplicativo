// src/pages/Profile.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  CreditCard,
  Save,
  LogOut,
  Building2,
  MapPin,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";

/* -------------------- Helpers -------------------- */
const onlyDigits = (v: string) => (v || "").replace(/\D+/g, "");

const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
};

const formatCNPJ = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
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

/* ----- Title Case preservando espaços digitados ----- */
const capSingle = (w: string) =>
  w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "";

const titleAllWordsLive = (input: string) => {
  if (!input) return "";
  const hadTrailing = /\s$/.test(input);
  const core = input.toLowerCase().replace(/\s{2,}/g, " ").trimStart();
  const words = core
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.includes("-") ? w.split("-").map(capSingle).join("-") : capSingle(w)))
    .join(" ");
  return hadTrailing ? words + " " : words;
};

const titleAllWordsFinal = (input: string) => titleAllWordsLive(input).trim();
/* -------------------------------------------------- */

type Props = { onBack: () => void };

type Form = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  clinicName: string;
  clinicCnpj: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail: string;
};

const SELECT_COLS =
  "id, name, cpf, phone, email, clinic_name, clinic_cnpj, clinic_address, clinic_phone, clinic_email, clinic_logo_key, updated_at";

const STORAGE_BUCKET = "clinic-logos";

export default function Profile({ onBack }: Props) {
  const [form, setForm] = useState<Form>({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    clinicName: "",
    clinicCnpj: "",
    clinicAddress: "",
    clinicPhone: "",
    clinicEmail: "",
  });

  const [dbRow, setDbRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; cpf?: string; phone?: string }>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoKey, setLogoKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ========= carregar ========= */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) { setLoading(false); return; }

        const { data: base } = await supabase
          .from("profiles")
          .select(SELECT_COLS)
          .eq("id", uid)
          .maybeSingle();

        if (alive && base) {
          setDbRow(base);
          setLogoKey(base?.clinic_logo_key ?? null);
          setForm({
            name: titleAllWordsFinal(base?.name ?? ""),
            cpf: formatCPF(base?.cpf ?? ""),
            phone: formatBRCell(base?.phone ?? ""),
            email: base?.email ?? auth.user?.email ?? "",
            clinicName: base?.clinic_name ?? "",
            clinicCnpj: formatCNPJ(base?.clinic_cnpj ?? ""),
            clinicAddress: base?.clinic_address ?? "",
            clinicPhone: formatBRCell(base?.clinic_phone ?? ""),
            clinicEmail: base?.clinic_email ?? "",
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ========= URL pública do logo (com cache-bust) ========= */
  const logoUrl = useMemo(() => {
    if (!logoKey) return null;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(logoKey);
    const v = dbRow?.updated_at ? new Date(dbRow.updated_at).getTime() : Date.now();
    return `${data.publicUrl}?v=${v}`;
  }, [logoKey, dbRow?.updated_at]);

  /* ========= helpers UI ========= */
  const inputClass = (err?: boolean) =>
    `w-full pr-3 pl-9 py-2 rounded-xl border bg-white text-gray-900 focus:outline-none focus:ring-2 ${
      err
        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
        : "border-gray-200 focus:ring-blue-500 focus:border-blue-500"
    }`;

  const onChange =
    (field: keyof Form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setErrors((s) => ({ ...s, [field]: undefined }));
      if (field === "name") setForm((f) => ({ ...f, name: titleAllWordsLive(v) }));
      else if (field === "clinicName") setForm((f) => ({ ...f, clinicName: titleAllWordsLive(v) }));
      else if (field === "cpf") setForm((f) => ({ ...f, cpf: formatCPF(v) })); 
      else if (field === "phone") setForm((f) => ({ ...f, phone: formatBRCell(v) }));
      else if (field === "clinicCnpj") setForm((f) => ({ ...f, clinicCnpj: formatCNPJ(v) }));
      else if (field === "clinicPhone") setForm((f) => ({ ...f, clinicPhone: formatBRCell(v) }));
      else setForm((f) => ({ ...f, [field]: v }));
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

  /* ========= salvar ========= */
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const payload: any = {
        id: uid,
        name: titleAllWordsFinal(form.name),
        cpf: onlyDigits(form.cpf) || null,
        phone: onlyDigits(form.phone) || null,
        email: form.email?.trim() || null,
        clinic_name: titleAllWordsFinal(form.clinicName) || null,
        clinic_cnpj: onlyDigits(form.clinicCnpj) || null,
        clinic_address: form.clinicAddress?.trim() || null,
        clinic_phone: onlyDigits(form.clinicPhone) || null,
        clinic_email: form.clinicEmail?.trim() || null,
        clinic_logo_key: logoKey || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;

      setDbRow(payload);
      alert("Perfil atualizado com sucesso!");
    } catch (e: any) {
      console.error("save profile error:", e);
      alert(e.message ?? "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  /* ========= upload/remover logo ========= */
  const pickLogo = () => fileInputRef.current?.click();

  const handleUploadLogo = async (file: File) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return alert("Envie uma imagem (PNG/JPG/SVG).");
    if (file.size > 3 * 1024 * 1024) return alert("Tamanho máximo: 3 MB.");

    try {
      setLogoUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const ext = file.name.split(".").pop() || "png";
      const path = `${uid}/logo_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upErr) throw upErr;

      const { error: upsertErr } = await supabase
        .from("profiles").update({ clinic_logo_key: path, updated_at: new Date().toISOString() }).eq("id", uid);
      if (upsertErr) throw upsertErr;

      setLogoKey(path);
      setDbRow((prev: any) => ({ ...(prev ?? {}), clinic_logo_key: path, updated_at: new Date().toISOString() }));
    } catch (e: any) {
      console.error("upload logo error:", e);
      alert(e.message ?? "Falha ao enviar logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoKey) return;
    if (!confirm("Remover logo da clínica?")) return;
    try {
      setLogoUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      await supabase.storage.from(STORAGE_BUCKET).remove([logoKey]);
      const { error } = await supabase
        .from("profiles")
        .update({ clinic_logo_key: null, updated_at: new Date().toISOString() })
        .eq("id", uid);
      if (error) throw error;

      setLogoKey(null);
      setDbRow((prev: any) => ({ ...(prev ?? {}), clinic_logo_key: null, updated_at: new Date().toISOString() }));
    } catch (e: any) {
      console.error("remove logo error:", e);
      alert(e.message ?? "Falha ao remover logo");
    } finally {
      setLogoUploading(false);
    }
  };

  /* ========= sair ========= */
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

  /* ========= render ========= */
  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="inline-flex items-center text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Perfil</h1>
        <div className="w-[64px]" />
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-6 max-w-xl mx-auto">
        {/* ===== Dados do usuário ===== */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Dados do usuário</h2>

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
              autoCapitalize="words"
              spellCheck={false}
            />
          </div>
          {errors.name && <p className="mb-3 text-xs text-red-600">{errors.name}</p>}

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

          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <div className="relative">
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
        </section>

        <hr className="border-gray-100" />

        {/* ===== Dados da clínica ===== */}
        <section>
          <h2 className="text-sm font-semibold text-slate-600 mb-3">Dados da clínica</h2>

          {/* Logo */}
          <div className="flex items-center gap-4 mb-2">
            <div className="relative h-16 w-16 rounded-xl bg-gray-100 ring-1 ring-gray-200 overflow-hidden flex items-center justify-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo da clínica" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-gray-400" />
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={pickLogo}
                disabled={logoUploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-60"
                title="Enviar/Alterar logo"
              >
                <Upload className="w-4 h-4" />
                {logoUploading ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
              </button>

              {logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={logoUploading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  title="Remover logo"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadLogo(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {/* Nome da clínica */}
          <label className="block text-sm text-gray-600 mb-1">Nome da clínica</label>
          <div className="relative mb-1">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Ex.: Clínica Vida"
              value={form.clinicName}
              onChange={onChange("clinicName")}
              onBlur={() => setForm((f) => ({ ...f, clinicName: titleAllWordsFinal(f.clinicName) }))}
              className={inputClass()}
              disabled={loading || saving}
              autoCapitalize="words"
            />
          </div>

          {/* CNPJ */}
          <label className="block text-sm text-gray-600 mb-1">CNPJ</label>
          <div className="relative mb-1">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={form.clinicCnpj}
              onChange={onChange("clinicCnpj")}
              className={inputClass()}
              disabled={loading || saving}
            />
          </div>

          {/* Endereço */}
          <label className="block text-sm text-gray-600 mb-1">Endereço</label>
          <div className="relative mb-1">
            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <textarea
              placeholder="Rua, número, bairro, cidade/UF"
              value={form.clinicAddress}
              onChange={onChange("clinicAddress")}
              className={`w-full pr-3 pl-9 py-2 rounded-xl border bg-white text-gray-900 focus:outline-none focus:ring-2 border-gray-200 focus:ring-blue-500 focus:border-blue-500 min-h-[70px] resize-y`}
              disabled={loading || saving}
            />
          </div>

          {/* Telefone da clínica */}
          <label className="block text-sm text-gray-600 mb-1">Telefone da clínica</label>
          <div className="relative mb-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(11) 9 9999-9999"
              value={form.clinicPhone}
              onChange={onChange("clinicPhone")}
              className={inputClass()}
              disabled={loading || saving}
            />
          </div>

          {/* Email da clínica */}
          <label className="block text-sm text-gray-600 mb-1">Email da clínica</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              placeholder="contato@clinica.com"
              value={form.clinicEmail}
              onChange={onChange("clinicEmail")}
              className={inputClass()}
              disabled={loading || saving}
            />
          </div>

          {/* Ações */}
          <div className="pt-2">
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
        </section>
      </div>
    </div>
  );
}
