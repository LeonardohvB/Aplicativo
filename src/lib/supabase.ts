import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lidas SOMENTE do Vite (frontend). process.env não existe no browser.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// Validação simples de URL
const isValidUrl = (url: string): boolean => {
  try { new URL(url); return true; } catch { return false; }
};

// Indicador para você usar na UI/logs se quiser
export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY) && isValidUrl(SUPABASE_URL);

let supabase: SupabaseClient;

if (isSupabaseConfigured) {
  // Cliente real
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  // Proxy que lança um erro claro se alguém tentar usar o cliente sem configurar as envs
  const msg =
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ex.: em .env.local no DEV ou em Environment Variables na Vercel).';

  if (import.meta.env.DEV) {
    // Ajuda visual durante o desenvolvimento
    // eslint-disable-next-line no-console
    console.warn('⚠️', msg);
  }

  supabase = new Proxy({}, {
    get() { throw new Error(msg); },
    apply() { throw new Error(msg); }
  }) as unknown as SupabaseClient;
}

export { supabase };
