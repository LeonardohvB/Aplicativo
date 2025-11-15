// src/hooks/useProfessionalFiles.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  uploadProfessionalFile,
  deleteProfessionalFile,
  publicUrlFromProfessionalPath,
  downloadProfessionalFile,
} from "../lib/professionalFiles";

export type ProfessionalFile = {
  id: string;
  tenant_id: string;
  professional_id: string;
  bucket: string;
  storage_path: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  category: string | null;
  notes: string | null;
  created_at: string;
};

export function useProfessionalFiles(tenantId?: string, professionalId?: string) {
  const [files, setFiles] = useState<ProfessionalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    // Se ainda não temos tenant/profissional, só limpa lista e erro
    if (!tenantId || !professionalId) {
      setFiles([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("professional_files")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("load professional_files error:", error);
      setError("Erro ao carregar arquivos.");
    } else {
      setFiles((data ?? []) as ProfessionalFile[]);
    }

    setLoading(false);
  }, [tenantId, professionalId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const uploadFile = useCallback(
    async (file: File, category: string | null) => {
      // Segurança extra: se por algum motivo ainda não tiver ids, só não faz nada
      if (!tenantId || !professionalId) {
        console.warn(
          "uploadFile chamado sem tenantId/professionalId",
          tenantId,
          professionalId
        );
        return;
      }

      setLoading(true);
      setError(null);

      try {
        await uploadProfessionalFile({
          tenantId,
          professionalId,
          file,
          category,
        });

        // Recarrega lista
        await loadFiles();
      } catch (err: any) {
        console.warn("uploadProfessionalFile error:", err);
        setError(err?.message || "Falha ao enviar arquivo.");
      } finally {
        setLoading(false);
      }
    },
    [tenantId, professionalId, loadFiles]
  );

  const removeFile = useCallback(async (id: string, storagePath: string) => {
    setLoading(true);
    setError(null);
    try {
      await deleteProfessionalFile(id, storagePath);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      console.warn("deleteProfessionalFile error:", err);
      setError(err?.message || "Falha ao remover arquivo.");
    } finally {
      setLoading(false);
    }
  }, []);

  const getPublicUrl = useCallback((path: string) => {
    return publicUrlFromProfessionalPath(path);
  }, []);

  // NOVO: download direto via SDK (bucket privado, respeita RLS)
  const downloadFile = useCallback(
    async (file: ProfessionalFile) => {
      setLoading(true);
      setError(null);
      try {
        await downloadProfessionalFile(file.storage_path, file.filename);
      } catch (err: any) {
        console.warn("downloadProfessionalFile error:", err);
        setError(err?.message || "Falha ao baixar arquivo.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    files,
    loading,
    error,
    uploadFile,
    removeFile,
    getPublicUrl,  // ainda disponível se usar em outro lugar
    downloadFile,  // <── usar na UI
  };
}
