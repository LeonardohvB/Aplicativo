import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AppointmentJourney, AppointmentSlot, Patient } from '../types';
import { useAppointmentHistory } from './useAppointmentHistory';

export const useAppointmentJourneys = () => {
  const [journeys, setJourneys] = useState<AppointmentJourney[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToHistory } = useAppointmentHistory();

  const fetchJourneys = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_journeys')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        if (error.message === 'Supabase not configured') {
          console.warn('Using mock data for journeys - Supabase not configured');
          setJourneys([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        professionalId: item.professional_id,
        professionalName: item.professional_name,
        date: item.date,
        startTime: item.start_time,
        endTime: item.end_time,
        consultationDuration: item.consultation_duration,
        bufferDuration: item.buffer_duration,
        totalSlots: item.total_slots,
        defaultPrice: Number(item.default_price),
        defaultBillingMode: item.default_billing_mode as 'clinica' | 'profissional',
        clinicPercentage: item.clinic_percentage || 20,
      })) || [];

      setJourneys(formattedData);
    } catch (error) {
      console.error('Error fetching journeys:', error);
    }
  };

  
const todayLocalISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};


  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_slots')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        if (error.message === 'Supabase not configured') {
          console.warn('Using mock data for slots - Supabase not configured');
          setSlots([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        journeyId: item.journey_id,
        professionalId: item.professional_id,
        patientId: item.patient_id,
        slotNumber: item.slot_number,
        startTime: item.start_time,
        endTime: item.end_time,
        date: item.date,
        status: item.status as AppointmentSlot['status'],
        service: item.service,
        price: Number(item.price),
        billingMode: item.billing_mode as 'clinica' | 'profissional',
        patientName: item.patient_name,
        patientPhone: item.patient_phone,
        notes: item.notes,
        clinicPercentage: item.clinic_percentage || 20,
        startedAt: item.started_at,
        finishedAt: item.finished_at,
        modality: (item.modality as 'presencial' | 'online') ?? 'presencial',
      })) || [];

      setSlots(formattedData);
    } catch (error) {
      console.error('Error fetching slots:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        if (error.message === 'Supabase not configured') {
          console.warn('Using mock data for patients - Supabase not configured');
          setPatients([]);
          return;
        }
        throw error;
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        name: item.name,
        phone: item.phone,
        email: item.email,
        notes: item.notes,
      })) || [];

      setPatients(formattedData);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const createJourney = async (journey: {
    professionalId: string;
    professionalName: string;
    date: string;
    startTime: string;
    endTime: string;
    defaultPrice: number;
    clinicPercentage: number;
  }) => {
    try {
     // depois
    const today = todayLocalISO();
    if (journey.date === today) {
    const now = new Date();
    const currentTime =
    `${now.getHours().toString().padStart(2, '0')}:` +
    `${now.getMinutes().toString().padStart(2, '0')}`;

  if (journey.startTime < currentTime) {
    throw new Error('Não é possível agendar para um horário que já passou hoje');
  }
}


      // Criar apenas um slot para todo o período
      const startMinutes = timeToMinutes(journey.startTime);
      const endMinutes = timeToMinutes(journey.endTime);
      const totalSlots = 1; // Apenas um slot para todo o período

      // Criar jornada
      const { data: journeyData, error: journeyError } = await supabase
        .from('appointment_journeys')
        .insert([{
          professional_id: journey.professionalId,
          professional_name: journey.professionalName,
          date: journey.date,
          start_time: journey.startTime,
          end_time: journey.endTime,
          consultation_duration: endMinutes - startMinutes, // Duração total
          buffer_duration: 0, // Sem intervalo
          total_slots: totalSlots,
          default_price: journey.defaultPrice,
          default_billing_mode: 'clinica',
          clinic_percentage: journey.clinicPercentage,
        }])
        .select()
        .single();

      if (journeyError) throw journeyError;

      // Criar um único slot para todo o período
      const slotsToCreate = [{
        journey_id: journeyData.id,
        professional_id: journey.professionalId,
        slot_number: 1,
        start_time: journey.startTime,
        end_time: journey.endTime,
        date: journey.date,
        price: journey.defaultPrice,
        billing_mode: 'clinica',
        clinic_percentage: journey.clinicPercentage,
      }];

      const { error: slotsError } = await supabase
        .from('appointment_slots')
        .insert(slotsToCreate);

      if (slotsError) throw slotsError;

      await fetchJourneys();
      await fetchSlots();
    } catch (error) {
      console.error('Error creating journey:', error);
    }
  };

  const updateJourney = async (journeyId: string, journey: {
    professionalId: string;
    professionalName: string;
    date: string;
    startTime: string;
    endTime: string;
    defaultPrice: number;
    clinicPercentage: number;
  }) => {
    try {
      // Validar se é hoje e o horário não é anterior ao atual
      const today = new Date().toISOString().split('T')[0];
      if (journey.date === today) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (journey.startTime < currentTime) {
          throw new Error('Não é possível agendar para um horário que já passou hoje');
        }
      }

      // Buscar slots existentes para preservar dados dos pacientes
      const existingSlots = slots.filter(slot => slot.journeyId === journeyId);
      const scheduledSlots = existingSlots.filter(slot => 
        slot.status !== 'disponivel' && slot.patientName
      );

      // Criar apenas um slot para todo o período
      const startMinutes = timeToMinutes(journey.startTime);
      const endMinutes = timeToMinutes(journey.endTime);
      const totalSlots = 1; // Apenas um slot para todo o período

      // Atualizar jornada
      const { error: journeyError } = await supabase
        .from('appointment_journeys')
        .update({
          professional_id: journey.professionalId,
          professional_name: journey.professionalName,
          date: journey.date,
          start_time: journey.startTime,
          end_time: journey.endTime,
          consultation_duration: endMinutes - startMinutes, // Duração total
          buffer_duration: 0, // Sem intervalo
          total_slots: totalSlots,
          default_price: journey.defaultPrice,
          default_billing_mode: 'clinica',
          clinic_percentage: journey.clinicPercentage,
        })
        .eq('id', journeyId);

      if (journeyError) throw journeyError;

      // Remover slots antigos
      const { error: deleteError } = await supabase
        .from('appointment_slots')
        .delete()
        .eq('journey_id', journeyId);

      if (deleteError) throw deleteError;

      // Criar novo slot preservando dados do paciente se existir
      const hasScheduledPatient = scheduledSlots.length > 0;
      const scheduledSlot = scheduledSlots[0]; // Pega o primeiro slot agendado
      
      const newSlot = {
        journey_id: journeyId,
        professional_id: journey.professionalId,
        slot_number: 1,
        start_time: journey.startTime,
        end_time: journey.endTime,
        date: journey.date,
        price: journey.defaultPrice,
        billing_mode: 'clinica',
        clinic_percentage: journey.clinicPercentage,
      };

      // Se havia paciente agendado, preservar os dados
      if (hasScheduledPatient) {
  Object.assign(newSlot, {
    patient_id: scheduledSlot.patientId,
    status: scheduledSlot.status,
    service: scheduledSlot.service,   // mantém o serviço do paciente
    price: scheduledSlot.price,
    patient_name: scheduledSlot.patientName,
    patient_phone: scheduledSlot.patientPhone,
    notes: scheduledSlot.notes,
  });
}


      const slotsToCreate = [newSlot];

      const { error: slotsError } = await supabase
        .from('appointment_slots')
        .insert(slotsToCreate);

      if (slotsError) throw slotsError;

      await fetchJourneys();
      await fetchSlots();
    } catch (error) {
      console.error('Error updating journey:', error);
    }
  };

  const deleteJourney = async (journeyId: string) => {
    try {
      // Os slots serão deletados automaticamente devido ao CASCADE
      const { error } = await supabase
        .from('appointment_journeys')
        .delete()
        .eq('id', journeyId);

      if (error) throw error;

      await fetchJourneys();
      await fetchSlots();
    } catch (error) {
      console.error('Error deleting journey:', error);
    }
  };

  const schedulePatient = async (slotId: string, patientData: {
    patientName: string;
    patientPhone: string;
    service: string;
    price: number;
    modality: 'presencial' | 'online';
    notes?: string;
  }) => {
    try {
      // Buscar o slot para obter a porcentagem da clínica da jornada
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        throw new Error('Slot não encontrado');
      }

      // Criar ou encontrar paciente
      let patientId = null;
      const existingPatient = patients.find(p => 
        p.name.toLowerCase() === patientData.patientName.toLowerCase() &&
        p.phone === patientData.patientPhone
      );

      if (existingPatient) {
        patientId = existingPatient.id;
      } else if (patientData.patientName) {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert([{
            name: patientData.patientName,
            phone: patientData.patientPhone,
          }])
          .select()
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
        await fetchPatients();
      }

      // Atualizar slot
      const { error } = await supabase
        .from('appointment_slots')
        .update({
          patient_id: patientId,
          status: 'agendado',
          service: patientData.service,
          price: patientData.price,
          billing_mode: 'clinica',
          patient_name: patientData.patientName,
          patient_phone: patientData.patientPhone,
          notes: patientData.notes,
          clinic_percentage: slot.clinicPercentage, // Usar a porcentagem da jornada
          modality: patientData.modality,
        })
        .eq('id', slotId);

      if (error) throw error;

      await fetchSlots();
    } catch (error) {
      console.error('Error scheduling patient:', error);
    }
  };

  const updateSlotStatus = async (slotId: string, status: AppointmentSlot['status']) => {
    try {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        throw new Error('Slot não encontrado');
      }

      // Preparar dados para atualização
      const updateData: any = { status };
      
      // Adicionar timestamp baseado no status
      if (status === 'em_andamento') {
        updateData.started_at = new Date().toISOString();
        updateData.finished_at = null; // Limpar finished_at ao iniciar
      } else if (['concluido', 'cancelado', 'no_show'].includes(status)) {
        updateData.finished_at = new Date().toISOString();
        
        // Calcular duração real se existe started_at
        const currentSlot = slots.find(s => s.id === slotId);
        if (currentSlot?.startedAt || slot.status === 'em_andamento') {
          // Buscar o started_at mais recente do banco
          const { data: slotData } = await supabase
            .from('appointment_slots')
            .select('started_at')
            .eq('id', slotId)
            .single();
          
          const startedAt = slotData?.started_at || currentSlot?.startedAt;
          if (startedAt) {
            const startTime = new Date(startedAt);
            const endTime = new Date(updateData.finished_at);
            const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
            updateData.actual_duration = Math.max(1, durationMinutes); // Mínimo 1 minuto
          }
        }
      }

      const { error } = await supabase
        .from('appointment_slots')
        .update(updateData)
        .eq('id', slotId);

      if (error) throw error;

      // Se finalizado, cancelado ou no_show, adicionar ao histórico e criar lançamentos financeiros
      if (['concluido', 'cancelado', 'no_show'].includes(status) && slot.patientName) {
        try {
          // Buscar nome do profissional
          const { data: professional } = await supabase
            .from('professionals')
            .select('name')
            .eq('id', slot.professionalId)
            .single();

          // Buscar dados atualizados do slot para pegar os timestamps
          const { data: updatedSlot } = await supabase
            .from('appointment_slots')
            .select('started_at, finished_at')
            .eq('id', slotId)
            .single();

          // Calcular duração real se ambos os timestamps existirem
          let actualDuration = undefined;
          if (updatedSlot?.started_at && updatedSlot?.finished_at) {
            const startTime = new Date(updatedSlot.started_at);
            const endTime = new Date(updatedSlot.finished_at);
            actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // em minutos
          }

          // Adicionar ao histórico
          await addToHistory({
            id: slot.id,
            professionalId: slot.professionalId,
            professionalName: professional?.name || 'Profissional não encontrado',
            patientId: slot.patientId,
            patientName: slot.patientName,
            patientPhone: slot.patientPhone,
            service: slot.service,
            price: slot.price,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: status as 'concluido' | 'cancelado' | 'no_show',
            billingMode: slot.billingMode,
            clinicPercentage: slot.clinicPercentage || 20,
            notes: slot.notes,
            actualDuration,
            startedAt: updatedSlot?.started_at,
            finishedAt: updatedSlot?.finished_at,
            modality: slot.modality ?? 'presencial',
          });
        } catch (historyError) {
          console.error('Error adding to history:', historyError);
          // Continua mesmo se houver erro no histórico
        }

        // Se concluído, criar lançamentos financeiros
        if (status === 'concluido') {
          await createFinancialEntries(slot);
        }
      }

      await fetchSlots();
    } catch (error) {
      console.error('Error updating slot status:', error);
    }
  };

  const updatePatient = async (slotId: string, patientData: {
    patientName: string;
    patientPhone: string;
    service: string;
    notes?: string;
  }) => {
    try {
      // Buscar o slot para manter o preço e outras configurações
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        throw new Error('Slot não encontrado');
      }

      // Criar ou encontrar paciente
      let patientId = slot.patientId;
      const existingPatient = patients.find(p => 
        p.name.toLowerCase() === patientData.patientName.toLowerCase() &&
        p.phone === patientData.patientPhone
      );

      if (existingPatient) {
        patientId = existingPatient.id;
      } else if (patientData.patientName) {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert([{
            name: patientData.patientName,
            phone: patientData.patientPhone,
          }])
          .select()
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
        await fetchPatients();
      }

      // Atualizar slot
      const { error } = await supabase
        .from('appointment_slots')
        .update({
          patient_id: patientId,
          service: patientData.service,
          patient_name: patientData.patientName,
          patient_phone: patientData.patientPhone,
          notes: patientData.notes,
        })
        .eq('id', slotId);

      if (error) throw error;

      await fetchSlots();
    } catch (error) {
      console.error('Error updating patient:', error);
    }
  };

  const createFinancialEntries = async (slot: AppointmentSlot) => {
    try {
      // Buscar nome do profissional
      const { data: professional } = await supabase
        .from('professionals')
        .select('name')
        .eq('id', slot.professionalId)
        .single();

      const professionalName = professional?.name || 'Profissional não encontrado';

      // Calcula apenas a porcentagem da clínica para o financeiro
      const clinicPercentage = (slot.clinicPercentage || 20) / 100;
      const clinicAmount = slot.price * clinicPercentage;
      
      const entry = {
        slot_id: slot.id,
        professional_id: slot.professionalId,
        type: 'income',
        description: `Atendimento - ${slot.patientName} (${slot.service})\n${professionalName}`,
        amount: clinicAmount, // Apenas a porcentagem da clínica
        date: new Date(slot.date + 'T00:00:00').toLocaleDateString('pt-BR'),

        category: 'Consultas',
      };

      // Inserir na tabela transactions para aparecer no financeiro
      const { error } = await supabase
        .from('transactions')
        .insert([{
          type: entry.type,
          description: entry.description,
          amount: entry.amount,
          date: entry.date,
          category: entry.category,
          professional_id: entry.professional_id,
        }]);

      if (error) throw error;

      // Também inserir na tabela financial_entries para controle interno
      const financialEntries = [];

      const professionalPercentage = 1 - clinicPercentage;

      financialEntries.push({
        slot_id: slot.id,
        professional_id: slot.professionalId,
        type: 'receita_clinica',
        description: `Receita Clínica - ${slot.patientName}`,
        amount: slot.price * clinicPercentage,
        status: 'pago',
        billing_mode: 'clinica',
        date: slot.date,
      });

      financialEntries.push({
        slot_id: slot.id,
        professional_id: slot.professionalId,
        type: 'repasse_profissional',
        description: `Repasse - ${slot.patientName}`,
        amount: slot.price * professionalPercentage,
        status: 'pendente',
        billing_mode: 'profissional',
        date: slot.date,
      });

      const { error: financialError } = await supabase
        .from('financial_entries')
        .insert(financialEntries);

      if (financialError) throw financialError;
    } catch (error) {
      console.error('Error creating financial entries:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchJourneys(), fetchSlots(), fetchPatients()]);
      setLoading(false);
    };

    fetchData();
  }, []);

  return {
    journeys,
    slots,
    patients,
    loading,
    createJourney,
    updateJourney,
    deleteJourney,
    schedulePatient,
    updatePatient,
    updateSlotStatus,
  };
};

// Funções auxiliares
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};