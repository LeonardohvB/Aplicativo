import { supabase } from './supabase'

export type Profile = {
  id: string
  tenant_id: string
  display_name?: string | null
}

/**
 * Obtém o profile do usuário autenticado.
 * Se não existir, cria UM NOVO profile apenas com { id, display_name }.
 * O tenant_id é gerado automaticamente pelo DEFAULT da coluna no banco.
 */
export async function getOrCreateOwnProfile(): Promise<Profile> {
  if (!supabase) throw new Error('Supabase não configurado')

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const user = userData.user
  if (!user) throw new Error('Usuário não autenticado')

  // tenta buscar o profile já existente
  const { data: existing, error: selErr } = await supabase
    .from('profiles')
    .select('id, tenant_id, display_name')
    .eq('id', user.id)
    .maybeSingle()

  if (selErr) throw selErr
  if (existing) return existing as Profile

  // não existe -> cria; NÃO envia tenant_id (o banco gera)
  const { data: inserted, error: insErr } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      display_name: user.email ?? null,
    })
    .select('id, tenant_id, display_name')
    .single()

  if (insErr) throw insErr
  return inserted as Profile
}

/** Helper opcional: retorna apenas o tenant atual do usuário logado. */
export async function getCurrentTenantId(): Promise<string> {
  const p = await getOrCreateOwnProfile()
  return p.tenant_id
}
