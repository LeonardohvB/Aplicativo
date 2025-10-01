// src/hooks/useEvolutionFiles.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  uploadEvolutionFile,
  deleteEvolutionFile,
  publicUrlFromEvolutionPath,
  UploadResult,
} from "../lib/evolutionFiles";

export type EvolutionFile = {
  id: string;
  evolution_id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type HookReturn = {
  files: EvolutionFile[];
  loading: boolean;
  error: string | null;
  fetchFiles: () => Promise<void>;
  uploadFile: (file: File) => Promise<UploadResult | null>;
  removeFile: (fileId: string, filePath: string) => Promise<void>;
  getPublicUrl: (filePath: string) => string;
};

/**
 * Hook para gerenciar anexos de uma evolução clínica.
 * Atenção: precisa do tenantId (perfil do usuário) para subir arquivos.
 */
export function useEvolutionFiles(
  evolutionId?: string,
  tenantId?: string
): HookReturn {
  const [files, setFiles] = useState<EvolutionFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!evolutionId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("patient_evolution_files")
      .select("*")
      .eq("evolution_id", evolutionId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setFiles(data || []);

    setLoading(false);
  }, [evolutionId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      if (!evolutionId) {
        setError("evolutionId ausente.");
        return null;
      }
      if (!tenantId) {
        setError("tenantId ausente (carregue do perfil do usuário).");
        return null;
      }

      try {
        const res = await uploadEvolutionFile({
          tenantId,
          evolutionId,
          file,
        });
        await fetchFiles();
        return res;
      } catch (e: any) {
        setError(e?.message || "Falha ao enviar arquivo");
        return null;
      }
    },
    [evolutionId, tenantId, fetchFiles]
  );

  const removeFile = useCallback(
    async (fileId: string, filePath: string) => {
      try {
        await deleteEvolutionFile({ rowId: fileId, filePath });
        await fetchFiles();
      } catch (e: any) {
        setError(e?.message || "Falha ao excluir arquivo");
      }
    },
    [fetchFiles]
  );

  const getPublicUrl = (filePath: string) => publicUrlFromEvolutionPath(filePath);

  return { files, loading, error, fetchFiles, uploadFile, removeFile, getPublicUrl };
}
