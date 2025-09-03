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
