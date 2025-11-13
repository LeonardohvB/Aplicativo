// src/pages/ProfessionalRecord.tsx
import React, { useState, useEffect } from "react";
import { Search, FilePlus2, Loader2, Trash2, ExternalLink } from "lucide-react";
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

export default function ProfessionalRecord() {
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selected, setSelected] = useState<Professional | null>(null);

  const [tenantId, setTenantId] = useState<string | null>(null);

  // Carrega tenant_id do usuário logado
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const t =
        (data.session?.user?.user_metadata as any)?.tenant_id ?? null;
      setTenantId(t);
    });
  }, []);

  // Buscar profissionais do tenant
  const fetchProfessionals = async () => {
    if (!tenantId) return;
    setLoadingList(true);

    const { data, error } = await supabase
      .from("professionals")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (!error && data) {
      setProfessionals(data as Professional[]);
    }

    setLoadingList(false);
  };

  useEffect(() => {
    if (tenantId) fetchProfessionals();
  }, [tenantId]);

  // Hook de arquivos do profissional selecionado
  const {
    files,
    loading,
    error,
    uploadFile,
    removeFile,
    getPublicUrl,
  } = useProfessionalFiles(tenantId ?? undefined, selected?.id);

  const filteredList = professionals.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.cpf.includes(search)
  );

  // Upload com escolha de categoria via prompt (simples por enquanto)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;

    const categorySelect = prompt(
      "Selecione a categoria (digite exatamente):\n\n" +
        CATEGORIES.map((c) => `- ${c.label}`).join("\n")
    );

    if (!categorySelect) return;

    const matched = CATEGORIES.find(
      (c) => c.label.toLowerCase() === categorySelect.toLowerCase()
    );

    const category = matched?.value ?? "outros";

    await uploadFile(file, category);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-4 text-center">
        Registro do Profissional
      </h1>

      {/* Bloco de busca / lista de profissionais */}
      <div className="bg-white rounded-xl border p-4 shadow-sm mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="flex-1 border rounded-lg px-3 py-2 focus:ring focus:outline-none"
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
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.cpf}</div>
              <div className="text-xs text-gray-600">{p.specialty}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bloco de documentos do profissional selecionado */}
      {selected && (
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">
            Documentos de {selected.name}
          </h2>

          {/* Upload */}
          <div className="flex items-center gap-3 mb-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <FilePlus2 className="w-4 h-4" />
              Enviar arquivo
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={handleUpload}
              />
            </label>

            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            )}
          </div>

          {/* Lista de arquivos */}
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
                    {f.file_name}
                  </div>

                  <div className="text-xs text-gray-500">
                    Categoria:{" "}
                    <span className="font-medium text-gray-700">
                      {
                        CATEGORIES.find((c) => c.value === f.category)?.label ||
                        "Outros"
                      }
                    </span>
                  </div>

                  <div className="text-xs text-gray-400">
                    {new Date(f.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href={getPublicUrl(f.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                    title="Abrir"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

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
  );
}
