// src/lib/reporting.ts
import { supabase } from '../lib/supabase';

export type ReportFilters = {
  from: string;          // YYYY-MM-DD
  to: string;            // YYYY-MM-DD
  professionalId?: string | null;
};

export type SlotDb = {
  id: string;
  journey_date: string;          // 'YYYY-MM-DD'
  start_time: string | null;     // 'HH:MM'
  end_time: string | null;
  status: string;                // disponivel/agendado/em_andamento/concluido/cancelado/no_show
  price: number | null;          // se existir no seu schema
  professional_id: string | null;
  patient_name?: string | null;  // se existir no seu schema
};

export async function fetchSlotsForReport(filters: ReportFilters): Promise<SlotDb[]> {
  const { from, to, professionalId } = filters;

  let q = supabase
    .from('slots')
    .select('id, journey_date, start_time, end_time, status, price, professional_id, patient_name')
    .gte('journey_date', from)
    .lte('journey_date', to)
    .order('journey_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (professionalId) q = q.eq('professional_id', professionalId);

  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export function buildSummary(slots: SlotDb[], f: ReportFilters) {
  const byStatus: Record<string, number> = {};
  let revenue = 0;
  let totalDurationMinutes = 0;

  for (const s of slots) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    if (s.price) revenue += Number(s.price);

    if (s.start_time && s.end_time) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      const minutes = (eh * 60 + em) - (sh * 60 + sm);
      if (!Number.isNaN(minutes) && minutes > 0) totalDurationMinutes += minutes;
    }
  }

  return {
    periodLabel: `${f.from} a ${f.to}`,
    professionalLabel: f.professionalId ? 'Selecionado' : 'Todos',
    total: slots.length,
    byStatus,
    revenue,
    totalDurationMinutes,
  };
}
