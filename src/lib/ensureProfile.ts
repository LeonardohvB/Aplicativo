// src/lib/ensureProfile.ts
import { supabase } from './supabase'

let ensureOnce: Promise<any> | null = null

/**
 * Garante que exista uma linha em `profiles` para o usuário logado.
 * - Usa UPSERT para evitar violação de chave única.
 * - É idempotente (roda no máx. 1x por sessão).
 * - Sempre trata erros e nunca explode a UI.
 */
export function ensureProfile() {
  if (ensureOnce) return ensureOnce

  ensureOnce = (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) return null

      // Tenta buscar
      const { data: found, error: selErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!selErr && found) return found

      // Não existe → UPSERT mínimo (só id). Se sua tabela exigir outros NOT NULL SEM default,
      // me diga os nomes que incluímos aqui.
      const { data: upserted, error: upErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id }, { onConflict: 'id' })
        .select('*')
        .single()

      if (upErr) {
        console.warn('ensureProfile upsert error:', upErr)
        return null
      }
      return upserted
    } catch (e) {
      console.warn('ensureProfile fatal:', e)
      return null
    }
  })()

  return ensureOnce
}
