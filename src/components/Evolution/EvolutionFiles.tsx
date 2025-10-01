// src/components/Evolution/EvolutionFiles.tsx
import React, { useRef, useState } from "react";
import { Paperclip, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { useEvolutionFiles } from "../../hooks/useEvolutionFiles";

type Props = {
  evolutionId: string;            // id da evolução
  tenantId: string;               // tenant do usuário logado (profiles.tenant_id)
  className?: string;
  accept?: string;                 // ex: "image/*,.pdf"
  maxSizeMB?: number;             // ex: 10
};

const bytes = (n?: number | null) =>
  typeof n === "number" && Number.isFinite(n)
    ? (n / (1024 * 1024)) >= 1
      ? `${(n / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(n / 1024))} KB`
    : "—";

const dt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : "—";

export default function EvolutionFiles({
  evolutionId,
  tenantId,
  className,
  accept = "image/*,application/pdf",
  maxSizeMB = 15,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  const {
    files,
    loading,
    error,
    uploadFile,
    removeFile,
    getPublicUrl,
  } = useEvolutionFiles(evolutionId, tenantId);

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    (e.target as HTMLInputElement).value = "";
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`Arquivo acima de ${maxSizeMB} MB`);
      return;
    }

    setSending(true);
    try {
      await uploadFile(file);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${className || ""}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-gray-700">
          <Paperclip className="w-4 h-4" />
          <span className="font-medium text-sm">Anexos da evolução</span>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPick}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={sending}
            title="Enviar arquivo"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {sending ? "Enviando..." : "Enviar arquivo"}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={accept}
            onChange={onChange}
          />
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Lista */}
      <div className="divide-y divide-gray-100">
        {files.length === 0 && !loading && (
          <div className="px-4 py-6 text-sm text-gray-500">
            Nenhum arquivo anexado até o momento.
          </div>
        )}

        {files.map((f) => {
          const url = getPublicUrl(f.file_path);
          return (
            <div key={f.id} className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-medium text-sm text-blue-700 hover:underline"
                    title={f.file_name || f.file_path}
                  >
                    {f.file_name || f.file_path}
                  </a>
                  <a href={url} target="_blank" rel="noreferrer" title="Abrir">
                    <ExternalLink className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </a>
                </div>
                <div className="text-xs text-gray-500">
                  {bytes(f.size_bytes)} · {f.mime_type || "tipo desconhecido"} · {dt(f.created_at)}
                </div>
              </div>

              <button
                className="p-2 rounded-lg hover:bg-red-50"
                onClick={() => removeFile(f.id, f.file_path)}
                title="Excluir arquivo"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
