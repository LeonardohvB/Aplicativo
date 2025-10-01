// src/lib/evolutionFiles.ts
import { supabase } from './supabase';

/**
 * Helpers para gerenciar arquivos de evolução clínica no bucket `clinic-evolutions`.
 * Regras do backend:
 * - Bucket: clinic-evolutions (public)
 * - Tabela: public.patient_evolution_files
 * - Trigger: preenche tenant_id a partir de patient_evolutions
 * - CHECK: file_path deve iniciar com `${tenant_id}/`
 *
 * Padrão de caminho salvo:
 *   clinic-evolutions/<tenant_id>/<evolution_id>/<uuid>-<slug>.<ext>
 */

const BUCKET = 'clinic-evolutions';

// Gera um ID estável sem depender do pacote 'uuid'
const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // fallback simples
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const slugify = (name: string) =>
  (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const getExt = (filename: string) => {
  const m = /\.[a-z0-9]+$/i.exec(filename || '');
  return m ? m[0] : '';
};

export type UploadResult = {
  row: {
    id: string;
    evolution_id: string;
    file_path: string;
    file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    created_at: string;
  };
  publicUrl: string;
};

/**
 * Faz upload para o Storage e registra o anexo na tabela patient_evolution_files.
 * OBS: o tenant_id é preenchido pelo trigger no banco.
 */
export async function uploadEvolutionFile(params: {
  tenantId: string;          // usado para compor o path
  evolutionId: string;
  file: File;
}): Promise<UploadResult> {
  const { tenantId, evolutionId, file } = params;

  if (!tenantId) throw new Error('tenantId obrigatório');
  if (!evolutionId) throw new Error('evolutionId obrigatório');
  if (!file) throw new Error('Arquivo não informado');

  const ext = getExt(file.name) || '';
  const base = slugify(file.name.replace(ext, '')) || 'arquivo';
  const key = `${genId()}-${base}${ext}`;
  const path = `${tenantId}/${evolutionId}/${key}`; // precisa começar com tenantId/ (CHECK no DB)

  // 1) Upload no Storage
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    throw new Error(`Falha no upload: ${upErr.message}`);
  }

  // 2) Inserir registro no DB (trigger preenche tenant_id)
  const { data: row, error: insErr } = await supabase
    .from('patient_evolution_files')
    .insert({
      evolution_id: evolutionId,
      file_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size ?? null,
    })
    .select('id, evolution_id, file_path, file_name, mime_type, size_bytes, created_at')
    .single();

  if (insErr) {
    // rollback do arquivo no Storage, para não ficar órfão
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new Error(`Falha ao registrar anexo: ${insErr.message}`);
  }

  // 3) URL pública
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    row: {
      id: row.id,
      evolution_id: row.evolution_id,
      file_path: row.file_path,
      file_name: row.file_name,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      created_at: row.created_at,
    },
    publicUrl: pub.publicUrl,
  };
}

/**
 * Remove um anexo: apaga do Storage e da tabela.
 * Você pode chamar passando o id da linha (recomendado) e o file_path.
 */
export async function deleteEvolutionFile(params: {
  rowId: string;
  filePath: string;
}): Promise<void> {
  const { rowId, filePath } = params;
  if (!rowId) throw new Error('rowId obrigatório');
  if (!filePath) throw new Error('filePath obrigatório');

  // 1) apaga arquivo do Storage (ignora erro de "não encontrado")
  await supabase.storage.from(BUCKET).remove([filePath]).catch(() => {});

  // 2) apaga linha no DB
  const { error: delErr } = await supabase
    .from('patient_evolution_files')
    .delete()
    .eq('id', rowId);

  if (delErr) {
    throw new Error(`Falha ao excluir registro: ${delErr.message}`);
  }
}

/**
 * Helper para obter URL pública a partir do file_path salvo.
 */
export function publicUrlFromEvolutionPath(filePath: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}
