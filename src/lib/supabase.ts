import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

const isValidUrl = (url: string) => { try { new URL(url); return true } catch { return false } }

export const isSupabaseConfigured =
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY && isValidUrl(SUPABASE_URL)

/** Quando as ENVs estão corretas temos o client; caso contrário, `null` (e a UI segue sem travar) */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null
// --- ADIÇÕES --- //
export async function ensureProfile() {
  if (!supabase) return; // suas ENVs podem não estar configuradas em dev
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    full_name: (user as any)?.user_metadata?.full_name ?? null,
  });
}

/** Inicia um listener global para manter profiles em dia quando o usuário logar */
let authSyncStarted = false;
export function startAuthProfileSync() {
  if (!supabase || authSyncStarted) return;
  authSyncStarted = true;

  // roda no login/refresh de sessão
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) ensureProfile();
  });
}

/** Sincroniza o profile imediatamente (ex.: no boot do app) */
export async function syncProfileNow() {
  if (!supabase) return;
  await ensureProfile();
}
