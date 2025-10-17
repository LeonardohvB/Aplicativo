// src/hooks/useAppointmentHistory.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppointmentHistory } from '../types';

export const useAppointmentHistory = () => {
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // 🔐 garante usuário
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setHistory([]);
        return;
      }

      // 🔎 seleciona colunas explicitamente (inclui owner_id) e filtra por dono no servidor
      const { data, error } = await supabase
        .from('appointment_history')
        .select(`
          id,
          professional_id,
          professional_name,
          patient_id,
          patient_name,
          patient_phone,
          service,
          price,
          date,
          start_time,
          end_time,
          status,
          billing_mode,
          clinic_percentage,
          notes,
          completed_at,
          actual_duration,
          started_at,
          finished_at,
          modality,
          owner_id,
          created_at
        `)
        .eq('owner_id', uid)
        // ordenação estável: por data, depois hora de início
        .order('date', { ascending: false })
        .order('start_time', { ascending: false });

      if (error) {
        // modo DEV sem supabase
        if (typeof error.message === 'string' && error.message.includes('Supabase not configured')) {
          console.warn('Using mock data for appointment history - Supabase not configured');
          setHistory([]);
          return;
        }
        throw error;
      }

      const formattedData: AppointmentHistory[] = (data ?? []).map((item: any) => ({
        id: item.id,
        professionalId: item.professional_id,
        professionalName: item.professional_name,
        patientId: item.patient_id,
        patientName: item.patient_name,
        patientPhone: item.patient_phone,
        service: item.service,
        price: Number(item.price) || 0,
        date: item.date,
        startTime: item.start_time,
        endTime: item.end_time,
        status: (item.status as AppointmentHistory['status']) ?? 'concluido',
        billingMode: (item.billing_mode as 'clinica' | 'profissional') ?? 'clinica',
        clinicPercentage: Number(item.clinic_percentage) || 0,
        notes: item.notes ?? null,
        completedAt: item.completed_at,
        actualDuration: item.actual_duration ?? undefined,
        startedAt: item.started_at ?? undefined,
        finishedAt: item.finished_at ?? undefined,
        modality: (item.modality as 'presencial' | 'online') ?? 'presencial',
        // opcionais no tipo; mantidos se existirem na tabela
        owner_id: item.owner_id,
        // se o seu tipo não tiver created_at, não tem problema: é ignorado no resto do app
        created_at: item.created_at,
      }));

      setHistory(formattedData);
    } catch (error) {
      console.error('Error fetching appointment history:', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Insere um atendimento no histórico.
   * Aceita `canceledAt` e `noShowAt` no tipo para manter compatibilidade com quem chama,
   * mas estes **não** são enviados ao banco (evita erro se as colunas não existirem).
   */
  const addToHistory = async (slot: {
    id: string;
    professionalId: string;
    professionalName?: string;
    patientId?: string;
    patientName: string;
    patientPhone?: string;
    service: string;
    price: number;
    date: string;       // YYYY-MM-DD
    startTime: string;  // HH:MM
    endTime: string;    // HH:MM
    status: 'concluido' | 'cancelado' | 'no_show';
    billingMode: 'clinica' | 'profissional';
    clinicPercentage?: number;
    notes?: string;
    actualDuration?: number;
    startedAt?: string;
    finishedAt?: string;
    modality?: 'presencial' | 'online';
    // 👇 apenas para tipagem (não será enviado ao DB aqui)
    canceledAt?: string;
    noShowAt?: string;
  }) => {
    try {
      // 🔐 uid para setar owner_id no insert (além do trigger, se houver)
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('No authenticated user');

      // Buscar nome do profissional se não fornecido
      let professionalName = slot.professionalName;
      if (!professionalName) {
        const { data: professional } = await supabase
          .from('professionals')
          .select('name')
          .eq('id', slot.professionalId)
          .single();

        professionalName = professional?.name || 'Profissional não encontrado';
      }

      // Só use chaves que com certeza existem na tabela
      const payload: any = {
        professional_id: slot.professionalId,
        professional_name: professionalName,
        patient_id: slot.patientId ?? null,
        patient_name: slot.patientName,
        patient_phone: slot.patientPhone ?? null,
        service: slot.service,
        price: Number(slot.price) || 0,
        date: slot.date,
        start_time: slot.startTime,
        end_time: slot.endTime,
        status: (slot.status ?? 'concluido').toLowerCase(),
        billing_mode: slot.billingMode,
        clinic_percentage: Number(slot.clinicPercentage ?? 20),
        notes: slot.notes ?? null,
        completed_at: new Date().toISOString(),
        actual_duration: slot.actualDuration ?? null,
        started_at: slot.startedAt ?? null,
        finished_at: slot.finishedAt ?? null,
        modality: slot.modality ?? 'presencial',
        owner_id: uid,
      };

      // Remove undefined para não enviar colunas vazias
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      const { error } = await supabase.from('appointment_history').insert([payload]);
      if (error) throw error;

      await fetchHistory();
    } catch (error) {
      console.error('Error adding to appointment history:', error);
    }
  };

  const getHistoryByProfessional = (professionalId: string) => {
    return history.filter((item) => item.professionalId === professionalId);
  };

  const getHistoryByPatient = (patientName: string) => {
    return history.filter((item) =>
      (item.patientName ?? '').toLowerCase().includes(patientName.toLowerCase())
    );
  };

  const getHistoryByDateRange = (startDate: string, endDate: string) => {
    return history.filter((item) => item.date >= startDate && item.date <= endDate);
  };

  const getHistoryStats = () => {
    const totalAppointments = history.length;
    const completedAppointments = history.filter((h) => (h.status ?? '').toLowerCase() === 'concluido').length;
    const cancelledAppointments = history.filter((h) => (h.status ?? '').toLowerCase() === 'cancelado').length;
    const noShowAppointments = history.filter((h) => (h.status ?? '').toLowerCase() === 'no_show').length;

    const totalRevenue = history
      .filter((h) => (h.status ?? '').toLowerCase() === 'concluido')
      .reduce(
        (sum, h) => sum + (Number(h.price) || 0) * ((Number(h.clinicPercentage) || 0) / 100),
        0
      );

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalRevenue,
      completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0,
    };
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return {
    history,
    loading,
    addToHistory,
    getHistoryByProfessional,
    getHistoryByPatient,
    getHistoryByDateRange,
    getHistoryStats,
    refetch: fetchHistory,
  };
};
