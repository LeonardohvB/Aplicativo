// src/lib/getUid.ts
import { supabase } from './supabase'
export async function getUid() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
