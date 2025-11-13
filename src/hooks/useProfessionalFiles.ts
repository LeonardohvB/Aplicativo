// src/hooks/useProfessionalFiles.ts
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  uploadProfessionalFile,
  deleteProfessionalFile,
  publicUrlFromProfessionalPath,
  UploadProfessionalResult,
} from "../lib/professionalFiles";

export type ProfessionalFile = {
  id: string;
  tenant_id: string;
  professional_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  category: string | null;
  created_at: string;
};

type HookReturn = {
  files: ProfessionalFile[];
  loading: boolean;
  error: string | null;
  fetchFiles: () => Promise<void>;
  uploadFile: (file: File, category?: string | null) => Promise<UploadProfessionalResult | null>;
  removeFile: (rowId: string, path: string) => Promise<void>;
  getPublicUrl: (filePath: string) => string;
};

export function useProfessionalFiles(
  tenantId?: string,
  professionalId?: string
): HookReturn {
  const [files, setFiles] = useState<ProfessionalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!tenantId || !professionalId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("professional_files")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("professional_id", professionalId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setFiles((data || []) as ProfessionalFile[]);
    }

    setLoading(false);
  }, [tenantId, professionalId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(
    async (file: File, category?: string | null) => {
      if (!tenantId || !professionalId) {
        setError("tenantId ou professionalId ausente.");
        return null;
      }

      try {
        const result = await uploadProfessionalFile({
          tenantId,
          professionalId,
          file,
          category: category ?? null,
        });

        await fetchFiles();
        return result;
      } catch (e: any) {
        setError(e?.message || "Falha ao enviar arquivo.");
        return null;
      }
    },
    [tenantId, professionalId, fetchFiles]
  );

  const removeFile = useCallback(
    async (rowId: string, path: string) => {
      try {
        await deleteProfessionalFile(rowId, path);
        await fetchFiles();
      } catch (e: any) {
        setError(e?.message || "Falha ao excluir arquivo.");
      }
    },
    [fetchFiles]
  );

  const getPublicUrl = (filePath: string) => publicUrlFromProfessionalPath(filePath);

  return { files, loading, error, fetchFiles, uploadFile, removeFile, getPublicUrl };
}
