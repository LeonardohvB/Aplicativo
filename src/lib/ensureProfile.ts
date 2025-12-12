// src/lib/ensureProfile.ts
import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

let ensureOnce: Promise<any> | null = null

export function ensureProfile() {
  if (ensureOnce) return ensureOnce

  ensureOnce = (async () => {
    try {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) return null

      // 1️⃣ Já existe profile por ID?
      const { data: found, error: selErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!selErr && found) return found

      // 2️⃣ Existe profile com esse email? (caso profissional criado antes)
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .maybeSingle()

      if (byEmail) {
        // Vincula Auth ao profile existente
        const { data: linked } = await supabase
          .from('profiles')
          .update({ id: user.id })
          .eq('email', user.email)
          .select('*')
          .single()

        return linked
      }

      // 3️⃣ NÃO existe → é OWNER → cria tenant
      const tenant_id = uuidv4()

      const { data: created, error: upErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email,
            tenant_id,
            role: 'owner',
            full_name: user.user_metadata?.full_name ?? null,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single()

      if (upErr) {
        console.warn('ensureProfile upsert error:', upErr)
        return null
      }

      return created
    } catch (e) {
      console.warn('ensureProfile fatal:', e)
      return null
    }
  })()

  return ensureOnce
}
