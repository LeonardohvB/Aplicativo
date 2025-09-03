import { supabase, isSupabaseConfigured } from './supabase'

export type AuthSession = {
  user: { id: string; email?: string | null } | null
  access_token: string | null
}

export async function getCurrentSession(): Promise<AuthSession> {
  if (!isSupabaseConfigured || !supabase) {
    return { user: null, access_token: null }
  }
  const { data } = await supabase.auth.getSession()
  const s = data.session
  return { user: s?.user ?? null, access_token: s?.access_token ?? null }
}

export function onAuthChange(cb: () => void) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe() {/* noop */} } } } as any
  }
  return supabase.auth.onAuthStateChange(() => cb())
}

export async function signInEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
