import { supabase } from './supabase'

export type Profile = {
  id: string
  tenant_id: string
  display_name?: string | null
}

export async function getOrCreateOwnProfile(defaultTenantId?: string): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')

  // tenta buscar a profile
  const { data: rows, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .limit(1)

  if (error) throw error
  if (rows && rows.length > 0) return rows[0] as Profile

  // cria com tenant padrão
  if (!defaultTenantId) throw new Error('Perfil não existe e defaultTenantId não definido')
  const { data: inserted, error: insErr } = await supabase
    .from('profiles')
    .insert({ id: user.id, tenant_id: defaultTenantId, display_name: user.email })
    .select()
    .single()

  if (insErr) throw insErr
  return inserted as Profile
}
