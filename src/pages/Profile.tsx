// src/pages/Profile.tsx
import React, { useEffect, useRef, useState } from "react";
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
  Upload,
  Trash2,
} from "lucide-react";

import ConfirmDialog from "../components/ui/ConfirmDialog";
import { ToastContainer, useToast } from "../components/ui/Toast";

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
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
};

const capSingle = (w: string) =>
  w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : "";
const titleAllWordsLive = (s: string) => {
  const orig = s || "";
  const hasTrailingSpace = /\s$/.test(orig);
  const normalized = orig
    .toLowerCase()
    .replace(/\s{2,}/g, " ")
    .trimStart()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.includes("-") ? w.split("-").map(capSingle).join("-") : capSingle(w)))
    .join(" ");
  return hasTrailingSpace ? normalized + " " : normalized;
};
const titleAllWordsFinal = (s: string) => titleAllWordsLive(s).trim();
/* -------------------------------------------------- */

type Props = { onBack: () => void };

type Form = {
  // usuário
  name: string;
  cpf: string;
  phone: string;
  email: string;
  // clínica
  clinicName: string;
  clinicCnpj: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicEmail: string;
};

const BASE_COLS = "id, name, cpf, phone, email";
const CLINIC_COLS =
  "clinic_name, clinic_cnpj, clinic_address, clinic_phone, clinic_email, clinic_logo_path";

const BUCKET = "clinic-logos"; // bucket sugerido

export default function Profile({ onBack }: Props) {
  const { success, error } = useToast();

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
  const [hasRow, setHasRow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; cpf?: string; phone?: string }>({});

  // Logo
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirms
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // URL pública a partir do path
  const publicUrlFromPath = (path?: string | null) => {
    if (!path) return null;
    try {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl || null;
    } catch {
      return null;
    }
  };

  /* ========= carregar ========= */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) {
          setLoading(false);
          return;
        }

        // base
        const { data: base, error: e1 } = await supabase
          .from("profiles")
          .select(BASE_COLS)
          .eq("id", uid)
          .maybeSingle();
        if (e1 && e1.code !== "PGRST116") console.warn("profile base error:", e1);

        // clínica
        let clinic: any = {};
        const { data: cData, error: e2 } = await supabase
          .from("profiles")
          .select(CLINIC_COLS)
          .eq("id", uid)
          .maybeSingle();
        if (!e2) clinic = cData ?? {};
        else if (e2.code !== "PGRST116" && e2.code !== "42703") {
          console.warn("clinic cols error:", e2);
        }

        const merged = { ...(base ?? {}), ...(clinic ?? {}) };

        if (alive) {
          setHasRow(!!base);
          setDbRow(merged);

          setForm({
            name: titleAllWordsFinal(merged?.name ?? ""),
            cpf: formatCPF(merged?.cpf ?? ""),
            phone: formatBRCell(merged?.phone ?? ""),
            email: merged?.email ?? auth.user?.email ?? "",
            clinicName: merged?.clinic_name ?? "",
            clinicCnpj: formatCNPJ(merged?.clinic_cnpj ?? ""),
            clinicAddress: merged?.clinic_address ?? "",
            clinicPhone: formatBRCell(merged?.clinic_phone ?? ""),
            clinicEmail: merged?.clinic_email ?? "",
          });

          const path = merged?.clinic_logo_path ?? null;
          const url = publicUrlFromPath(path);
          setLogoPath(path);
          setLogoUrl(url);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      if (field === "name")
        setForm((f) => ({ ...f, name: titleAllWordsLive(v) }));
      else if (field === "cpf")
        setForm((f) => ({ ...f, cpf: formatCPF(v) }));
      else if (field === "phone")
        setForm((f) => ({ ...f, phone: formatBRCell(v) }));
      else if (field === "clinicCnpj")
        setForm((f) => ({ ...f, clinicCnpj: formatCNPJ(v) }));
      else if (field === "clinicPhone")
        setForm((f) => ({ ...f, clinicPhone: formatBRCell(v) }));
      else if (field === "clinicName")
        setForm((f) => ({ ...f, clinicName: titleAllWordsLive(v) }));
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

  const keepOr = (val: string, prev?: string | null) =>
    val.trim() === "" ? (prev ?? null) : val.trim();

  /* ========= upload/remover logo ========= */
  const handleUploadLogo = async (file: File) => {
    try {
      setLogoUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const ext = file.name.split(".").pop() || "png";
      const fname = `${Date.now()}.${ext.toLowerCase()}`;
      const path = `${uid}/${fname}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) throw upErr;

      if (logoPath && logoPath !== path) {
        await supabase.storage.from(BUCKET).remove([logoPath]).catch(() => {});
      }

      const payload: any = { clinic_logo_path: path };
      let saveErr: any = null;
      if (hasRow) {
        const { error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("id", uid);
        saveErr = error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert([{ id: uid, ...payload }]);
        saveErr = error;
      }
      if (
        saveErr &&
        (saveErr.code === "42703" ||
          /column .* does not exist/i.test(saveErr.message))
      ) {
        // ignora falta de coluna
      } else if (saveErr) {
        throw saveErr;
      }

      const url = publicUrlFromPath(path);
      setLogoPath(path);
      setLogoUrl(url);
      success("Logo atualizada com sucesso.");
    } catch (e: any) {
      console.error("upload logo error:", e);
      error(e.message ?? "Erro ao enviar logo");
    } finally {
      setLogoUploading(false);
    }
  };

  const reallyRemoveLogo = async () => {
    try {
      setLogoUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      if (logoPath) {
        await supabase.storage.from(BUCKET).remove([logoPath]).catch(() => {});
      }

      const payload: any = { clinic_logo_path: null };
      let saveErr: any = null;
      const { error: updErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", uid);
      saveErr = updErr;
      if (
        saveErr &&
        (saveErr.code === "42703" ||
          /column .* does not exist/i.test(saveErr.message))
      ) {
        // ignora falta de coluna
      } else if (saveErr) {
        throw saveErr;
      }

      setLogoPath(null);
      setLogoUrl(null);
      success("Logo removida.");
    } catch (e: any) {
      console.error("remove logo error:", e);
      error(e.message ?? "Erro ao remover logo");
    } finally {
      setLogoUploading(false);
      setConfirmRemoveLogo(false);
    }
  };

  /* ========= salvar ========= */
  const handleSave = async () => {
    if (!validate()) {
      error("Corrija os campos destacados.");
      return;
    }

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Usuário não autenticado.");

      const basePayload = {
        name: keepOr(titleAllWordsFinal(form.name), dbRow?.name),
        cpf: keepOr(onlyDigits(form.cpf), dbRow?.cpf),
        phone: keepOr(onlyDigits(form.phone), dbRow?.phone),
        email: keepOr(form.email, dbRow?.email),
      };
      const clinicPayload = {
        clinic_name: keepOr(
          titleAllWordsFinal(form.clinicName),
          dbRow?.clinic_name
        ),
        clinic_cnpj: keepOr(onlyDigits(form.clinicCnpj), dbRow?.clinic_cnpj),
        clinic_address: keepOr(form.clinicAddress, dbRow?.clinic_address),
        clinic_phone: keepOr(onlyDigits(form.clinicPhone), dbRow?.clinic_phone),
        clinic_email: keepOr(form.clinicEmail, dbRow?.clinic_email),
      };

      const trySave = async (payload: any) => {
        if (hasRow) {
          return supabase.from("profiles").update(payload).eq("id", uid);
        }
        return supabase
          .from("profiles")
          .insert([{ id: uid, ...payload }]);
      };

      let { error: saveErr } = await trySave({
        ...basePayload,
        ...clinicPayload,
      });

      if (
        saveErr &&
        (saveErr.code === "42703" ||
          /column .* does not exist/i.test(saveErr.message))
      ) {
        const r2 = await trySave(basePayload);
        saveErr = r2.error;
      }
      if (saveErr) throw saveErr;

      setDbRow((prev: any) => ({
        id: uid,
        ...(prev ?? {}),
        ...basePayload,
        ...clinicPayload,
      }));
      setHasRow(true);

      window.dispatchEvent(
        new CustomEvent("profile:saved", {
          detail: { name: basePayload.name || "" },
        })
      );
      success("Perfil atualizado com sucesso.");
    } catch (e: any) {
      console.error("save profile error:", e);
      error(e.message ?? "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const reallySignOut = async () => {
    try {
      setSigningOut(true);
      const { error: signErr } = await supabase.auth.signOut();
      if (signErr) throw signErr;
    } catch (e: any) {
      console.error("signOut error:", e);
      error(e.message ?? "Erro ao sair");
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* BOTÃO VOLTAR – padrão Mimoloo */}
      <div className="px-4 pt-4">
  <button
    onClick={onBack}
    className="inline-flex items-center text-blue-600 hover:text-blue-800"
  >
    <ArrowLeft className="w-5 h-5 mr-2" />
    Voltar
  </button>
</div>


      {/* CARD central — alinhado com PatientsNew / ProfessionalRecord */}
      <div className="w-full max-w-[1120px] mx-auto px-4 pb-24 mt-2 sm:mt-2">
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="mx-auto w-full max-w-5xl px-4 md:px-6">
            {/* Header do card */}
            <header className="border-b">
              <div className="px-4 sm:px-6 py-4 text-center">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  Perfil
                </h1>
              </div>
            </header>

            {/* Conteúdo */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* ===== Dados do usuário ===== */}
              <section>
                <h2 className="text-sm font-semibold text-slate-600 mb-3">
                  Dados do usuário
                </h2>

                <label className="block text-sm text-gray-600 mb-1">
                  Nome completo
                </label>
                <div className="relative mb-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ex.: Maria Clara D'Ávila"
                    value={form.name}
                    onChange={onChange("name")}
                    onBlur={() =>
                      setForm((f) => ({
                        ...f,
                        name: titleAllWordsFinal(f.name),
                      }))
                    }
                    className={inputClass(!!errors.name)}
                    disabled={loading || saving}
                  />
                </div>
                {errors.name && (
                  <p className="mb-3 text-xs text-red-600">{errors.name}</p>
                )}

                <label className="block text-sm text-gray-600 mb-1">
                  CPF
                </label>
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
                {errors.cpf && (
                  <p className="mb-3 text-xs text-red-600">{errors.cpf}</p>
                )}

                <label className="block text-sm text-gray-600 mb-1">
                  Telefone
                </label>
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
                {errors.phone && (
                  <p className="mb-3 text-xs text-red-600">{errors.phone}</p>
                )}

                <label className="block text-sm text-gray-600 mb-1">
                  Email
                </label>
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
                <h2 className="text-sm font-semibold text-slate-600 mb-3">
                  Dados da clínica
                </h2>

                {/* Logo da clínica */}
                <div className="mb-3 flex items-center gap-4">
                  <div className="relative h-16 w-16 rounded-xl bg-white ring-1 ring-gray-200 overflow-hidden flex items-center justify-center shadow-sm">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo da clínica"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-7 w-7 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path d="M3 17l6-6 4 4 5-5 3 3v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <path d="M14 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className={[
                        "group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-white shadow-sm",
                        "bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600",
                        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400",
                        "active:scale-[0.98] disabled:opacity-60",
                      ].join(" ")}
                      title="Enviar ou trocar logo"
                    >
                      <Upload className="h-4 w-4 transition-transform group-hover:-translate-y-[1px]" />
                      {logoUploading
                        ? "Enviando..."
                        : logoUrl
                        ? "Trocar logo"
                        : "Enviar logo"}
                    </button>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveLogo(true)}
                        disabled={logoUploading}
                        className={[
                          "inline-flex items-center gap-2 rounded-lg px-3 py-2",
                          "border border-slate-300 text-slate-700 hover:bg-slate-100",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300",
                          "active:scale-[0.98] disabled:opacity-60",
                        ].join(" ")}
                        title="Remover logo"
                      >
                        <Trash2 className="h-4 w-4" />
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

                <label className="block text-sm text-gray-600 mb-1">
                  Nome da clínica
                </label>
                <div className="relative mb-1">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Ex.: Clínica Vida"
                    value={form.clinicName}
                    onChange={onChange("clinicName")}
                    onBlur={() =>
                      setForm((f) => ({
                        ...f,
                        clinicName: titleAllWordsFinal(f.clinicName),
                      }))
                    }
                    className={inputClass()}
                    disabled={loading || saving}
                  />
                </div>

                <label className="block text-sm text-gray-600 mb-1">
                  CNPJ
                </label>
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

                <label className="block text-sm text-gray-600 mb-1">
                  Endereço
                </label>
                <div className="relative mb-1">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <textarea
                    placeholder="Rua, número, bairro, cidade/UF"
                    value={form.clinicAddress}
                    onChange={onChange("clinicAddress")}
                    className="w-full pr-3 pl-9 py-2 rounded-xl border bg-white text-gray-900 focus:outline-none focus:ring-2 border-gray-200 focus:ring-blue-500 focus:border-blue-500 min-h-[70px] resize-y"
                    disabled={loading || saving}
                  />
                </div>

                <label className="block text-sm text-gray-600 mb-1">
                  Telefone da clínica
                </label>
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

                <label className="block text-sm text-gray-600 mb-1">
                  Email da clínica
                </label>
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
              </section>

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
                  onClick={() => setConfirmSignOut(true)}
                  disabled={signingOut}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  title="Encerrar sessão"
                >
                  <LogOut className="w-4 h-4" />
                  {signingOut ? "Saindo..." : "Encerrar sessão"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={confirmRemoveLogo}
        onClose={() => setConfirmRemoveLogo(false)}
        onConfirm={reallyRemoveLogo}
        title="Remover a logo da clínica?"
        description="A imagem atual será apagada do armazenamento."
        confirmText="Remover"
        cancelText="Cancelar"
        icon={<Trash2 className="w-5 h-5" />}
      />

      <ConfirmDialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        onConfirm={reallySignOut}
        title="Encerrar sessão?"
        description="Você precisará entrar novamente para acessar o sistema."
        confirmText="Sair"
        cancelText="Cancelar"
        icon={<LogOut className="w-5 h-5" />}
      />

      <ToastContainer />
    </div>
  );
}
