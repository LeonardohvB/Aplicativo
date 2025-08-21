import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppointmentHistory } from '../types';

export const useAppointmentHistory = () => {
  const [history, setHistory] = useState<AppointmentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_history')
        .select('*')
        .order('completed_at', { ascending: false });

      if (error) {
        if (error.message === 'Supabase not configured') {
          console.warn('Using mock data for appointment history - Supabase not configured');
          setHistory([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        professionalId: item.professional_id,
        professionalName: item.professional_name,
        patientId: item.patient_id,
        patientName: item.patient_name,
        patientPhone: item.patient_phone,
        service: item.service,
        price: Number(item.price),
        date: item.date,
        startTime: item.start_time,
        endTime: item.end_time,
        status: item.status as AppointmentHistory['status'],
        billingMode: item.billing_mode as 'clinica' | 'profissional',
        clinicPercentage: Number(item.clinic_percentage),
        notes: item.notes,
        completedAt: item.completed_at,
        actualDuration: item.actual_duration,
        startedAt: item.started_at,
        finishedAt: item.finished_at,
      })) || [];

      setHistory(formattedData);
    } catch (error) {
      console.error('Error fetching appointment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToHistory = async (slot: {
    id: string;
    professionalId: string;
    professionalName?: string;
    patientId?: string;
    patientName: string;
    patientPhone?: string;
    service: string;
    price: number;
    date: string;
    startTime: string;
    endTime: string;
    status: 'concluido' | 'cancelado' | 'no_show';
    billingMode: 'clinica' | 'profissional';
    clinicPercentage?: number;
    notes?: string;
    actualDuration?: number;
    startedAt?: string;
    finishedAt?: string;
  }) => {
    try {
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

      const { error } = await supabase
        .from('appointment_history')
        .insert([{
          professional_id: slot.professionalId,
          professional_name: professionalName,
          patient_id: slot.patientId,
          patient_name: slot.patientName,
          patient_phone: slot.patientPhone,
          service: slot.service,
          price: slot.price,
          date: slot.date,
          start_time: slot.startTime,
          end_time: slot.endTime,
          status: slot.status,
          billing_mode: slot.billingMode,
          clinic_percentage: slot.clinicPercentage || 20,
          notes: slot.notes,
          completed_at: new Date().toISOString(),
          actual_duration: slot.actualDuration,
          started_at: slot.startedAt,
          finished_at: slot.finishedAt,
        }]);

      if (error) throw error;

      await fetchHistory();
    } catch (error) {
      console.error('Error adding to appointment history:', error);
    }
  };

  const getHistoryByProfessional = (professionalId: string) => {
    return history.filter(item => item.professionalId === professionalId);
  };

  const getHistoryByPatient = (patientName: string) => {
    return history.filter(item => 
      item.patientName.toLowerCase().includes(patientName.toLowerCase())
    );
  };

  const getHistoryByDateRange = (startDate: string, endDate: string) => {
    return history.filter(item => 
      item.date >= startDate && item.date <= endDate
    );
  };

  const getHistoryStats = () => {
    const totalAppointments = history.length;
    const completedAppointments = history.filter(h => h.status === 'concluido').length;
    const cancelledAppointments = history.filter(h => h.status === 'cancelado').length;
    const noShowAppointments = history.filter(h => h.status === 'no_show').length;
    const totalRevenue = history
      .filter(h => h.status === 'concluido')
      .reduce((sum, h) => sum + (h.price * (h.clinicPercentage / 100)), 0);

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      totalRevenue,
      completionRate: totalAppointments > 0 ? (completedAppointments / totalAppointments * 100) : 0,
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