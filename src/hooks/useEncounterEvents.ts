// src/hooks/useEncounterEvents.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type EncounterEvent = {
  id: string;
  owner_id: string;
  encounter_id: string;
  t_rel_ms: number;         // tempo relativo ao início (em ms)
  type: string;             // "vitals" | "note" | "med" | ...
  payload: any;             // dados do evento
  created_at: string;
};

export function useEncounterEvents(encounterId?: string) {
  const [events, setEvents] = useState<EncounterEvent[]>([]);
  const [loading, setLoading] = useState(false);

  /** Busca todos os eventos dessa sessão em ordem cronológica */
  const fetchEvents = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("encounter_events")
      .select("*")
      .eq("encounter_id", id)
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) throw error;
    setEvents((data || []) as EncounterEvent[]);
  };

  useEffect(() => {
    if (encounterId) fetchEvents(encounterId).catch(console.error);
  }, [encounterId]);

  /** Adiciona um novo evento à timeline */
  const addEvent = async (type: string, payload: any, t_rel_ms: number) => {
    if (!encounterId) throw new Error("encounterId ausente");
    const { data, error } = await supabase
      .from("encounter_events")
      .insert({ encounter_id: encounterId, type, payload, t_rel_ms })
      .select("*")
      .single();
    if (error) throw error;
    setEvents((prev) => [...prev, data as EncounterEvent]);
    return data as EncounterEvent;
  };

  /** (Opcional) Realtime: escuta inserts de outros clientes */
  useEffect(() => {
    if (!encounterId) return;
    const channel = supabase
      .channel(`encounter_events:${encounterId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "encounter_events",
          filter: `encounter_id=eq.${encounterId}`,
        },
        (payload) => {
          const row = payload.new as EncounterEvent;
          setEvents((prev) => [...prev, row]);
        }
      )
      .subscribe();
    return () => {
      try { channel.unsubscribe(); } catch {}
    };
  }, [encounterId]);

  return { events, loading, fetchEvents, addEvent };
}
