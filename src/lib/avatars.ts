// src/lib/avatars.ts
import { supabase } from './supabase'

// Converte para JPEG quando possível. Se não conseguir, devolve o arquivo original.
export async function toJpegBlob(file: File | Blob): Promise<Blob> {
  const type = (file as File).type ?? ''
  if (type && type.toLowerCase() === 'image/jpeg') return file

  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const out: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.92)
    )
    URL.revokeObjectURL(url)
    return out ?? file
  } catch {
    return file
  }
}

export function publicUrlFromPath(path: string): string {
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Sobe um novo avatar com nome único e APAGA todos os demais arquivos da pasta
 * professionals/<id>/ no bucket "avatars".
 */
export async function replaceProfessionalAvatar(
  professionalId: string,
  file: File | Blob
): Promise<{ path: string; publicUrl: string; updatedAt: string }> {
  // 1) gerar novo caminho único
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  const folder = `professionals/${professionalId}`
  const path = `${folder}/${uuid}.jpg`

  // 2) upload (jpeg)
  const jpeg = await toJpegBlob(file)
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, jpeg, {
    upsert: false,
    contentType: 'image/jpeg',
    cacheControl: '0',
  })
  if (upErr) throw upErr

  // 3) atualiza DB com o novo caminho + timestamp
  const updatedAt = new Date().toISOString()
  const { error: dbErr } = await supabase
    .from('professionals')
    .update({ avatar_path: path, avatar_updated_at: updatedAt })
    .eq('id', professionalId)
  if (dbErr) throw dbErr

  // 4) lista tudo na pasta e remove todos, exceto o atual
  const { data: list, error: listErr } = await supabase.storage
    .from('avatars')
    .list(folder, { limit: 1000 })
  if (listErr) {
    // não bloqueia o fluxo, mas avisa
    console.error('Falha ao listar arquivos para limpeza:', listErr)
  } else if (list?.length) {
    const toDelete = list
      .map((obj) => `${folder}/${obj.name}`)
      .filter((full) => full !== path)

    if (toDelete.length) {
      const { error: delErr } = await supabase.storage.from('avatars').remove(toDelete)
      if (delErr) {
        // mostra erro claro p/ você ajustar policies
        console.error('Falha ao remover arquivos antigos:', delErr)
        throw new Error(
          'Não foi possível apagar as fotos antigas. Verifique as policies de DELETE no bucket "avatars".'
        )
      }
    }
  }

  return {
    path,
    publicUrl: publicUrlFromPath(path),
    updatedAt,
  }
}

export async function deleteAllAvatarsForProfessional(professionalId: string) {
  const BUCKET = 'avatars'
  const prefix = `professionals/${professionalId}/`

  // lista os arquivos no prefixo
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 100,
    offset: 0,
    search: '',
  })
  if (error) {
    console.warn('Erro ao listar arquivos do prefixo:', error)
    return
  }
  if (!data || data.length === 0) return

  // remove todos os arquivos listados
  const paths = data.map((o) => `${prefix}${o.name}`)
  const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths)
  if (removeErr) {
    console.warn('Erro ao remover arquivos do prefixo:', removeErr)
  }
}

/* ===========================================================
   Wrappers esperados pelo ProfessionalCard.tsx
   =========================================================== */

/**
 * Compat: usado pelo card para subir a foto e limpar o prefixo.
 * Retorna { path, updatedAt } para cache-busting imediato no front.
 */
export async function uploadAvatarAndCleanup(
  professionalId: string,
  file: File
): Promise<{ path: string; updatedAt: string }> {
  const { path, updatedAt } = await replaceProfessionalAvatar(professionalId, file)
  return { path, updatedAt }
}

/**
 * Compat: usado pelo card para remover a foto e zerar colunas no DB.
 */
export async function removeAvatarAndCleanup(professionalId: string): Promise<void> {
  // apaga tudo do prefixo no storage
  await deleteAllAvatarsForProfessional(professionalId)

  // zera no banco
  const { error } = await supabase
    .from('professionals')
    .update({ avatar_path: null, avatar_updated_at: null })
    .eq('id', professionalId)
  if (error) throw error
}
