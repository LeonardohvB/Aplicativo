// src/pages/ProfessionalRecord.tsx
import React, { useState, useEffect } from "react";
import {
  Search,
  FilePlus2,
  Loader2,
  Trash2,
  Download,
  X,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useProfessionalFiles } from "../hooks/useProfessionalFiles";

type Professional = {
  id: string;
  name: string;
  cpf: string;
  specialty: string;
  phone: string;
  registration_code: string;
  tenant_id: string;
};

const CATEGORIES = [
  { value: "documento_pessoal", label: "Documento pessoal" },
  { value: "registro_conselho", label: "Registro do conselho" },
  { value: "diploma_certificado", label: "Diploma / Certificado" },
  { value: "comprovante_residencia", label: "Comprovante de residência" },
  { value: "outros", label: "Outros" },
];

type Props = {
  onBack?: () => void;
};

export default function ProfessionalRecord({ onBack }: Props) {
  // ---------- ESTADOS BÁSICOS ----------
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selected, setSelected] = useState<Professional | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // ---------- ESTADOS DO MODAL DE CATEGORIA ----------
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("documento_pessoal");
  const [otherCategory, setOtherCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else window.history.back();
  };

  // ---------- CARREGA tenant_id A PARTIR DO JWT ----------
  useEffect(() => {
    let canceled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = (data.session?.user?.user_metadata as any)?.tenant_id ?? null;
      if (!canceled) {
        setTenantId(t);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  // ---------- BUSCA PROFISSIONAIS ----------
  const fetchProfessionals = async (currentTenant?: string | null) => {
    setLoadingList(true);

    let query = supabase
      .from("professionals")
      .select("*")
      .order("name", { ascending: true });

    // se tiver tenant, filtra; se não, deixa sem filtro (RLS cuida)
    if (currentTenant) {
      query = query.eq("tenant_id", currentTenant);
    }

    const { data, error } = await query;

    if (!error && data) {
      setProfessionals(data as Professional[]);
    } else {
      console.warn("fetchProfessionals error", error);
      setProfessionals([]);
    }

    setLoadingList(false);
  };

  // chama sempre que tenantId mudar
  useEffect(() => {
    fetchProfessionals(tenantId);
  }, [tenantId]);

  // Hook de arquivos do profissional selecionado
  // usa tenantId do JWT, e se não tiver, cai para o tenant_id do profissional selecionado
  const effectiveTenantId = tenantId ?? selected?.tenant_id ?? undefined;

  const {
    files,
    loading,
    error,
    uploadFile,
    removeFile,
    getPublicUrl,
  } = useProfessionalFiles(effectiveTenantId, selected?.id);

  // ---------- FILTRO DA LISTA DE PROFISSIONAIS ----------
  const filteredList = professionals.filter((p) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return (
      p.name.toLowerCase().includes(term) ||
      (p.cpf && p.cpf.includes(term)) ||
      (p.phone && p.phone.includes(term)) ||
      (p.registration_code && p.registration_code.includes(term))
    );
  });

  // ---------- HANDLERS DE UPLOAD ----------
  // abre o modal assim que escolher o arquivo
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    setPendingFile(file);
    setCategory("documento_pessoal");
    setOtherCategory("");
    setCategoryModalOpen(true);
  };

  const handleConfirmUpload = async () => {
    // só trava se não tiver arquivo ou profissional selecionado
    if (!pendingFile || !selected || uploading) return;

    try {
      setUploading(true);

      const finalCategory =
        category === "outros"
          ? otherCategory.trim() || "outros"
          : category;

      await uploadFile(pendingFile, finalCategory);

      // se deu certo, fecha o modal e limpa estado
      setPendingFile(null);
      setCategoryModalOpen(false);
      setOtherCategory("");
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
      // mensagem de erro vem do hook em `error`
    } finally {
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    if (uploading) return; // evita cancelar no meio
    setPendingFile(null);
    setCategoryModalOpen(false);
    setOtherCategory("");
  };

  const handleDownload = (storagePath: string, filename: string) => {
    const url = getPublicUrl(storagePath);
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ---------- RENDER ----------
  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* topo – mesmo padrão do Profile */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>

        <h1 className="text-2xl font-bold text-gray-900">
          Registro do Profissional
        </h1>

        {/* espaçador para alinhar o título ao centro */}
        <div className="w-[64px]" />
      </div>

      {/* CARD principal */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-6 w-full max-w-6xl mx-auto">
        {/* BLOCO: BUSCA + LISTA DE PROFISSIONAIS */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, telefone ou registro..."
              className="flex-1 border rounded-lg px-3 py-2 focus:ring focus:outline-none border-gray-300 focus:border-blue-500 focus:ring-blue-200"
            />
          </div>

          {loadingList && (
            <div className="text-center py-3 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Carregando profissionais...
            </div>
          )}

          {!loadingList && filteredList.length === 0 && (
            <div className="text-center py-3 text-gray-500">
              Nenhum profissional encontrado.
            </div>
          )}

          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {filteredList.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selected?.id === p.id
                    ? "border-blue-500 bg-blue-50"
                    : "hover:bg-gray-50 border-gray-200"
                }`}
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">{p.cpf}</div>
                <div className="text-xs text-gray-600">{p.specialty}</div>
              </button>
            ))}
          </div>
        </div>

        {/* BLOCO: DOCUMENTOS DO PROFISSIONAL SELECIONADO */}
        {selected && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">
              Documentos de {selected.name}
            </h2>

            {/* BOTÃO DE UPLOAD */}
            <div className="flex items-center gap-3 mb-4">
              <label
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white
                  ${
                    selected
                      ? "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
              >
                <FilePlus2 className="w-4 h-4" />
                Enviar arquivo
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={!selected}
                />
              </label>

              {loading && (
                <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
              )}
            </div>

            {/* LISTA DE ARQUIVOS */}
            {files.length === 0 && (
              <div className="text-gray-500 text-sm py-4">
                Nenhum documento enviado ainda.
              </div>
            )}

            <div className="divide-y">
              {files.map((f) => (
                <div
                  key={f.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {f.filename}
                    </div>

                    <div className="text-xs text-gray-500">
                      Categoria:{" "}
                      <span className="font-medium text-gray-700">
                        {
                          CATEGORIES.find((c) => c.value === f.category)
                            ?.label || f.category || "Outros"
                        }
                      </span>
                    </div>

                    <div className="text-xs text-gray-400">
                      {new Date(f.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(f.storage_path, f.filename)
                      }
                      className="text-blue-600 hover:text-blue-800"
                      title="Baixar arquivo"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => removeFile(f.id, f.storage_path)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600">{error}</div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE CATEGORIA */}
      {categoryModalOpen && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                Selecionar categoria do arquivo
              </h3>
              <button
                onClick={handleCancelUpload}
                className="p-1 rounded-full hover:bg-gray-100"
                disabled={uploading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Arquivo:{" "}
              <span className="font-medium">{pendingFile.name}</span>
            </p>

            <div className="space-y-2 mb-4">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="file-category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                    disabled={uploading}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            {category === "outros" && (
              <div className="mb-4">
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Descreva a categoria..."
                  value={otherCategory}
                  onChange={(e) => setOtherCategory(e.target.value)}
                  disabled={uploading}
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelUpload}
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {uploading ? "Enviando..." : "Confirmar envio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
