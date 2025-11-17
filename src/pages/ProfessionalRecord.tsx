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
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selected, setSelected] = useState<Professional | null>(null);

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("documento_pessoal");
  const [otherCategory, setOtherCategory] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  /** VOLTAR */
  const handleBack = () => {
    if (onBack) onBack();
    else window.history.back();
  };

  /** CARREGAR TENANT */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const t = (data.session?.user?.user_metadata as any)?.tenant_id ?? null;
      if (!cancelled) setTenantId(t);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** BUSCAR PROFISSIONAIS */
  useEffect(() => {
    fetchProfessionals(tenantId);
  }, [tenantId]);

  const fetchProfessionals = async (tenant?: string | null) => {
    setLoadingList(true);
    let query = supabase.from("professionals").select("*").order("name");

    if (tenant) query = query.eq("tenant_id", tenant);

    const { data } = await query;
    setProfessionals(data || []);
    setLoadingList(false);
  };

  /** HOOK DE ARQUIVOS */
  const { files, loading, uploadFile, removeFile, getPublicUrl } =
    useProfessionalFiles(tenantId ?? selected?.tenant_id, selected?.id);

  /** FILTRO */
  const filteredList = professionals.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.cpf?.includes(term) ||
      p.phone?.includes(term) ||
      p.registration_code?.includes(term)
    );
  });

  /** UPLOAD */
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
    if (!pendingFile || !selected || uploading) return;

    try {
      setUploading(true);

      const finalCategory =
        category === "outros"
          ? otherCategory.trim() || "outros"
          : category;

      await uploadFile(pendingFile, finalCategory);

      setPendingFile(null);
      setCategoryModalOpen(false);
      setOtherCategory("");
    } finally {
      setUploading(false);
    }
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

  /* =====================================================================================
      RENDER — LAYOUT 100% IDÊNTICO AO CADASTRAR PACIENTE
  ===================================================================================== */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* BOTÃO VOLTAR */}
      <div className="px-4 pt-4 mb-2">
  <button
    onClick={onBack}
    className="inline-flex items-center text-blue-600 hover:text-blue-800"
  >
    <ArrowLeft className="w-5 h-5 mr-2" />
    Voltar
  </button>
</div>


      {/* CARD EXTERNO — IGUAL AO PACIENTE */}
      <div className="w-full max-w-[1120px] mx-auto px-4 pb-20">
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="mx-auto w-full max-w-5xl px-4 md:px-6">

            {/* TÍTULO SUP */}
            <header className="border-b">
              <div className="px-4 sm:px-6 py-4 text-center">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">
                  Registro do Profissional
                </h1>
              </div>
            </header>

            {/* CONTEÚDO */}
            <div className="p-4 space-y-6">

              {/* BUSCA */}
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome, CPF, telefone..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {loadingList && (
                  <div className="text-center py-3 text-sm text-gray-600">
                    <Loader2 className="inline w-4 h-4 animate-spin mr-2" />
                    Carregando...
                  </div>
                )}

                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className={`w-full text-left p-3 rounded-xl border transition ${
                        selected?.id === p.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.cpf}</div>
                      <div className="text-xs text-gray-600">{p.specialty}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* DOCUMENTOS */}
              {selected && (
                <div className="p-4">
                  <h2 className="text-lg font-semibold mb-4">
                    Documentos de {selected.name}
                  </h2>

                  {/* UPLOAD */}
                  <div className="flex items-center gap-3 mb-4">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
                      <FilePlus2 className="w-4 h-4" />
                      Enviar arquivo
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg"
                        className="hidden"
                        onChange={handleFileInputChange}
                      />
                    </label>

                    {loading && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    )}
                  </div>

                  {/* LISTA */}
                  {files.length === 0 && (
                    <p className="text-gray-500 text-sm">Nenhum documento enviado.</p>
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
                              {CATEGORIES.find((c) => c.value === f.category)?.label ||
                                f.category}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(f.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              handleDownload(f.storage_path, f.filename)
                            }
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => removeFile(f.id, f.storage_path)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {categoryModalOpen && pendingFile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                Selecionar categoria
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Arquivo: <strong>{pendingFile.name}</strong>
            </p>

            <div className="space-y-2 mb-4">
              {CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cat"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => setCategory(c.value)}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            {category === "outros" && (
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
                placeholder="Descreva..."
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
