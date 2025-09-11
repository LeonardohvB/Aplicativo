// src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lidas SOMENTE do Vite (frontend). process.env não existe no browser.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Validação simples de URL
const isValidUrl = (url: string): boolean => {
  try { new URL(url); return true } catch { return false }
}

// Indicador para usar na UI/logs se quiser
export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  isValidUrl(SUPABASE_URL)

let supabase: SupabaseClient

if (isSupabaseConfigured) {
  // ✅ Cliente real, com opções de Auth necessárias p/ web/PWA
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
} else {
  // ❌ Falta de ENV — falhe de forma clara no DEV
  const msg =
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (em .env.local no DEV ou em Environment Variables na Vercel).'
  if (import.meta.env.DEV) console.warn('⚠️', msg)

  // Proxy que lança um erro claro se alguém tentar usar o client sem configurar as envs
  supabase = new Proxy({}, {
    get() { throw new Error(msg) },
    apply() { throw new Error(msg) },
  }) as unknown as SupabaseClient
}

export { supabase }
