// src/lib/realtime.ts
import { supabase } from './supabase';

export type AppTable =
  | 'professionals'
  | 'patients'
  | 'appointment_journeys'
  | 'appointment_slots'
  | 'appointments'
  | 'transactions'
  | 'financial_entries';

/**
 * Assina eventos SOMENTE das linhas do usuário logado (owner_id = auth.uid()).
 * Retorna uma função de cleanup para desinscrever.
 */
export async function subscribeMyRows(
  table: AppTable,
  onChange: (payload: any) => void
) {
  const client = supabase;              // <- evita “possibly null” nas capturas
  if (!client) return () => {};

  const { data: { user } } = await client.auth.getUser();
  if (!user) return () => {};

  const channel = client
    .channel(`${table}-my-rows`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `owner_id=eq.${user.id}`, // recebe só eventos do meu owner_id
      },
      onChange
    )
    .subscribe();

  // função de limpeza (chamada no unmount / troca de tela)
  return () => {
    client.removeChannel(channel);      // <- usa client (não supabase direto)
  };
}

/** Remove TODOS os canais Realtime (use no logout) */
export async function unsubscribeAllRealtime() {
  const client = supabase;
  if (!client) return;
  await client.removeAllChannels();
}
