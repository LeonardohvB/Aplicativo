// src/lib/auth.ts
import { supabase, isSupabaseConfigured } from './supabase';
import { unsubscribeAllRealtime } from './realtime';

export type AuthSession = {
  user: { id: string; email?: string | null } | null;
  access_token: string | null;
};

export async function getCurrentSession(): Promise<AuthSession> {
  if (!isSupabaseConfigured || !supabase) {
    return { user: null, access_token: null };
  }
  const { data } = await supabase.auth.getSession();
  const s = data.session;
  return { user: s?.user ?? null, access_token: s?.access_token ?? null };
}

/** Listener simples para mudanças de auth; devolve objeto com .data.subscription.unsubscribe() */
export function onAuthChange(cb: () => void) {
  if (!supabase) {
    // fallback para não quebrar em dev sem ENV
    return { data: { subscription: { unsubscribe() {/* noop */} } } } as any;
  }
  return supabase.auth.onAuthStateChange(() => cb());
}

export async function signInEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpEmailPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase não configurado');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/** Encerra todos os canais Realtime e depois finaliza a sessão do usuário */
export async function signOut() {
  // fecha canais Realtime abertos (ignora falhas)
  try {
    await unsubscribeAllRealtime();
  } catch (err) {
    console.warn('Falha ao fechar canais Realtime:', err);
  }

  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;

  // (opcional) redirecionar após sair:
  // window.location.assign('/');
}
