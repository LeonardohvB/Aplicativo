// src/lib/professionalFiles.ts
import { supabase } from "../lib/supabase";
import { v4 as uuid } from "uuid";

const BUCKET = "professional-files";

export type UploadProfessionalFileParams = {
  tenantId: string;
  professionalId: string;
  file: File;
  category?: string | null; // ex.: "documento_pessoal", "registro_conselho"
};

export type UploadProfessionalResult = {
  id: string;
  storage_path: string;
  file_name: string;
  category: string | null;
};

/**
 * Gera o caminho final no bucket:
 * {tenantId}/{professionalId}/{uuid}.{ext}
 */
function buildStoragePath(tenantId: string, professionalId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const random = uuid();
  return `${tenantId}/${professionalId}/${random}.${ext}`;
}

/**
 * Cria URL pública (se o arquivo estiver acessível publicamente ou via signed URL)
 */
export function publicUrlFromProfessionalPath(filePath: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Upload do arquivo + INSERT na tabela professional_files
 */
export async function uploadProfessionalFile({
  tenantId,
  professionalId,
  file,
  category = null,
}: UploadProfessionalFileParams): Promise<UploadProfessionalResult> {
  const storagePath = buildStoragePath(tenantId, professionalId, file);

  // 1) Upload para o Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Falha no upload: " + uploadError.message);
  }

  // 2) Registrar na tabela professional_files
  const { data, error: insertError } = await supabase
    .from("professional_files")
    .insert([
      {
        tenant_id: tenantId,
        professional_id: professionalId,
        bucket: BUCKET,
        storage_path: storagePath,
        file_name: file.name,
        category,
      },
    ])
    .select()
    .single();

  if (insertError) {
    // rollback: remover arquivo do storage caso insert falhar
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error("Falha ao registrar arquivo no banco.");
  }

  return {
    id: data.id,
    storage_path: data.storage_path,
    file_name: data.file_name,
    category: data.category ?? null,
  };
}

/**
 * Remover arquivo do Storage + linha da tabela
 */
export async function deleteProfessionalFile(rowId: string, storagePath: string) {
  // 1) remover do Storage
  const { error: stError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (stError) throw new Error("Falha ao remover do storage.");

  // 2) remover registro do banco
  const { error: dbError } = await supabase
    .from("professional_files")
    .delete()
    .eq("id", rowId);

  if (dbError) throw new Error("Falha ao remover registro no banco.");
}
