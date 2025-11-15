// src/lib/professionalFiles.ts
import { supabase } from "../lib/supabase";
import { v4 as uuid } from "uuid";

const BUCKET = "professional-files";

export type UploadProfessionalFileParams = {
  tenantId: string;
  professionalId: string;
  file: File;
  category?: string | null; // "documento_pessoal", "registro_conselho", etc
};

export type UploadProfessionalResult = {
  id: string;
  storage_path: string;
  filename: string;
  category: string | null;
};

function buildStoragePath(tenantId: string, professionalId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const random = uuid();
  return `${tenantId}/${professionalId}/${random}.${ext}`;
}

export function publicUrlFromProfessionalPath(filePath: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadProfessionalFile({
  tenantId,
  professionalId,
  file,
  category = null,
}: UploadProfessionalFileParams): Promise<UploadProfessionalResult> {
  const storagePath = buildStoragePath(tenantId, professionalId, file);

  // 1) Upload para o Storage (bucket privado)
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadProfessionalFile storage error:", uploadError);
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
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
        category,
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error("insert professional_files error", insertError);
    // rollback se der ruim no insert
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error("Falha ao registrar arquivo no banco.");
  }

  return {
    id: data.id,
    storage_path: data.storage_path,
    filename: data.filename,
    category: data.category ?? null,
  };
}

export async function deleteProfessionalFile(rowId: string, storagePath: string) {
  const { error: stError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (stError) throw new Error("Falha ao remover do storage.");

  const { error: dbError } = await supabase
    .from("professional_files")
    .delete()
    .eq("id", rowId);

  if (dbError) throw new Error("Falha ao remover registro no banco.");
}

/**
 * Download de arquivo em bucket privado, respeitando RLS / auth.
 * - Baixa via Supabase SDK (rota autenticada)
 * - Cria um link temporário e dispara o download no navegador.
 */
export async function downloadProfessionalFile(
  storagePath: string,
  filename: string
) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !data) {
    console.error("downloadProfessionalFile storage error:", error);
    throw new Error("Falha ao baixar o arquivo.");
  }

  // data é um Blob no browser
  const blobUrl = URL.createObjectURL(data);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename || "arquivo";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(blobUrl);
}
