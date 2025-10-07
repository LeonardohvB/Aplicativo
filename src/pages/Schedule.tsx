// src/pages/Schedule.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import CreateJourneyModal from '../components/Schedule/CreateJourneyModal';
import EditJourneyModal from '../components/Schedule/EditJourneyModal';
import SchedulePatientModal from '../components/Schedule/SchedulePatientModal';
import EditPatientModal from '../components/Schedule/EditPatientModal';
import AppointmentHistoryModal from '../components/Schedule/AppointmentHistoryModal';
import AddPatientModal from '../components/Patients/AddPatientModal';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useProfessionals } from '../hooks/useProfessionals';
import { AppointmentSlot, AppointmentJourney } from '../types';
import KanbanAgenda from '../components/Schedule/KanbanAgenda';
import { supabase } from '../lib/supabase';

/* ===== Helpers (datas no fuso LOCAL) ===== */
const localISODate = (d = new Date()) => {
  const dd = new Date(d);
  dd.setMinutes(dd.getMinutes() - dd.getTimezoneOffset());
  return dd.toISOString().slice(0, 10);
};
const toLocalDateTime = (dateISO: string, timeHHMM: string) => {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(hh, mm, 0, 0);
  return d;
};
/** Extrai o id do agendamento a partir de um slot (tolerante a nomes) */
const getAppointmentIdFromSlot = (s: any): string | undefined =>
  s?.appointmentId ?? s?.appointment_id ?? s?.id;

/* Ordenações */
type SlotLite = Pick<AppointmentSlot, 'date' | 'startTime' | 'endTime'> & { id: string };
const sortSlotsByTime = (a: SlotLite, b: SlotLite) => {
  const now = new Date();
  const ta = toLocalDateTime(a.date, a.startTime);
  const tb = toLocalDateTime(b.date, b.startTime);
  const aPast = ta < now, bPast = tb < now;
  if (aPast !== bPast) return aPast ? 1 : -1;
  return ta.getTime() - tb.getTime();
};
const sortJourneysByDateTime = (a: AppointmentJourney, b: AppointmentJourney) => {
  const ta = toLocalDateTime(a.date, a.startTime);
  const tb = toLocalDateTime(b.date, b.startTime);
  const now = new Date();
  const aPast = ta < now, bPast = tb < now;
  if (aPast !== bPast) return aPast ? 1 : -1;
  return ta.getTime() - tb.getTime();
};

/* Filtros vindos do Dashboard */
const statusVisibleDefault = (status?: string) => {
  const s = (status || '').toLowerCase();
  return s === 'disponivel' || s === 'available' || s === 'agendado' || s === 'em_andamento';
};
const statusVisiblePeriod = (status?: string) => {
  const s = (status || '').toLowerCase();
  return s === 'agendado' || s === 'em_andamento';
};
function startEndOfThisWeek() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // domingo
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/* =========================== Página =========================== */
const Schedule: React.FC = () => {
  // Modais e seleções
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Modal de cadastro rápido de paciente
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<AppointmentJourney | null>(null);
  const [finishingSlot, setFinishingSlot] = useState<string | null>(null);

  const {
    journeys, slots, patients, loading,
    createJourney, updateJourney, deleteJourney,
    schedulePatient, updatePatient, updateSlotStatus,
  } = useAppointmentJourneys();

  const { professionals } = useProfessionals();

  // 🔁 Normaliza profissionais para o Kanban (garante avatar/versão)
  const professionalsForKanban = useMemo(
    () =>
      (professionals ?? []).map(p => ({
        ...p,
        avatarUrl: p.avatar || undefined,
        avatarUpdatedAt: p.avatarUpdatedAt || undefined,
      })),
    [professionals]
  );

  // Filtro vindo do Dashboard (Hoje/Semana)
  const [dashboardFilter, setDashboardFilter] = useState<'today' | 'week' | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<'today' | 'week'>).detail;
      setDashboardFilter(detail ?? null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('agenda:filter', handler as EventListener);
    return () => window.removeEventListener('agenda:filter', handler as EventListener);
  }, []);

// ✅ Atualiza a agenda sem recarregar quando o LiveEncounter avisar que concluiu
useEffect(() => {
  const onSlotUpdate = async (e: Event) => {
    const detail = (e as CustomEvent<{ appointmentId?: string; status?: string }>).detail;
    const appointmentId = detail?.appointmentId;
    const status = (detail?.status || 'concluido') as
      | 'concluido' | 'em_andamento' | 'cancelado' | 'no_show';

    if (!appointmentId) return;

    // Procura o slot correspondente por id/appointmentId
    const slot: any = slots.find(
      (s: any) =>
        s.id === appointmentId ||
        s.appointmentId === appointmentId ||
        s.appointment_id === appointmentId
    );
    if (!slot) return;

    try {
      await updateSlotStatus(slot.id, status); // isto já atualiza o estado do hook/local
    } catch (err) {
      console.warn('slot:update failed', err);
    }
  };

  window.addEventListener('agenda:slot:update', onSlotUpdate as EventListener);
  return () => window.removeEventListener('agenda:slot:update', onSlotUpdate as EventListener);
}, [slots, updateSlotStatus]);


  // ✅ Abrir histórico (menu suspenso OU Dashboard)
  useEffect(() => {
    const openHistory = () => setIsHistoryModalOpen(true);
    window.addEventListener('agenda:openHistory', openHistory as EventListener);

    const flagged = sessionStorage.getItem('schedule:openHistory');
    if (flagged) {
      sessionStorage.removeItem('schedule:openHistory');
      setIsHistoryModalOpen(true);
    }
    const handler = () => setIsHistoryModalOpen(true);
    window.addEventListener('agenda:history', handler);

    return () => {
      window.removeEventListener('agenda:openHistory', openHistory as EventListener);
      window.removeEventListener('agenda:history', handler);
    };
  }, []);

  // Abrir cadastro rápido de paciente (se algum lugar disparar o evento)
  useEffect(() => {
    const openNewPatient = () => setIsAddPatientOpen(true);
    window.addEventListener('patient:new', openNewPatient as EventListener);
    return () => window.removeEventListener('patient:new', openNewPatient as EventListener);
  }, []);



  const todayStr = localISODate(new Date());
  const { end } = startEndOfThisWeek();
  const startTomorrow = new Date();
  startTomorrow.setHours(0, 0, 0, 0);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  // Slots visíveis conforme filtro geral
  const filteredSlots = useMemo(() => {
    if (!Array.isArray(slots)) return [];
    const base =
      (dashboardFilter === 'today' || dashboardFilter === 'week')
        ? slots.filter(s => statusVisiblePeriod(s.status))
        : slots.filter(s => statusVisibleDefault(s.status));

    if (dashboardFilter === 'today') {
      return base.filter(s => s.date === todayStr);
    }
    if (dashboardFilter === 'week') {
      return base.filter(s => {
        const d = new Date(`${s.date}T12:00:00`);
        return d >= startTomorrow && d <= end;
      });
    }
    return base;
  }, [slots, dashboardFilter, todayStr, end]);

  // Jornadas que têm slots visíveis
  const visibleJourneys = useMemo(() => {
    const ids = new Set(filteredSlots.map(s => s.journeyId));
    return [...journeys].filter(j => ids.has(j.id)).sort(sortJourneysByDateTime);
  }, [journeys, filteredSlots]);

  /* ====== Passo B: garantir 1 encontro por agendamento ====== */

  // Abre o prontuário chamando a RPC ensure_encounter
  const handleOpenProntuarioFromSlot = async (slotId: string) => {
    const s: any = slots.find(x => x.id === slotId);
    if (!s) return;

    const appointmentId = getAppointmentIdFromSlot(s);
    if (!appointmentId) {
      alert('Não foi possível identificar o agendamento.');
      return;
    }

    const prof =
      professionals?.find(p => p.id === s.professionalId || p.id === s.professional_id);

    const meta = {
      patientName: s.patientName || s.patient_name || '',
      professionalName: prof?.name || s.professionalName || s.professional_name || '',
      serviceName: s.service || s.serviceName || s.service_name || '',
    };

    const { data: encounterId, error } = await supabase.rpc('ensure_encounter', {
      p_appointment_id: appointmentId,
      p_meta: meta,
    });

    if (error || !encounterId) {
      console.error('ensure_encounter error', error);
      alert('Não foi possível abrir o prontuário.');
      return;
    }

    // (opcional) marca visualmente como em andamento
    try { await updateSlotStatus(slotId, 'em_andamento'); } catch {}

    // abre a tela LiveEncounter (o componente já ouve esse evento)
    window.dispatchEvent(
      new CustomEvent('encounter:open', {
        detail: { encounterId, appointmentId, ...meta },
      })
    );
  };

  // Listener global: se o card do Kanban disparar esse evento com {slotId}
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ slotId: string }>).detail;
      if (detail?.slotId) handleOpenProntuarioFromSlot(detail.slotId);
    };
    window.addEventListener('agenda:openProntuario', handler as EventListener);
    return () => window.removeEventListener('agenda:openProntuario', handler as EventListener);
  }, [slots, professionals]);

  /* ===== Ações existentes ===== */
  const handleEditJourney = (journeyId: string) => {
    const j = journeys.find(x => x.id === journeyId);
    if (j) { setSelectedJourney(j); setIsEditModalOpen(true); }
  };
  const handleDeleteJourney = async (journeyId: string) => {
    if (confirm('Tem certeza que deseja excluir esse agendamento?')) {
      await deleteJourney(journeyId);
    }
  };
  const handleSchedulePatient = (slotId: string) => {
    const s = slots.find(x => x.id === slotId);
    if (s) { setSelectedSlot(s); setIsScheduleModalOpen(true); }
  };
  const handleEditPatient = (slotId: string) => {
    const s = slots.find(x => x.id === slotId);
    if (s) { setSelectedSlot(s); setIsEditPatientModalOpen(true); }
  };
  const handleConfirmSchedulePatient = async (slotId: string, data: {
    patientName: string; patientPhone: string; service: string; price: number; notes?: string;
  }) => { await schedulePatient(slotId, data); };

  const handleUpdatePatient = async (slotId: string, data: {
    patientName: string; patientPhone: string; service: string; notes?: string;
  }) => { await updatePatient(slotId, data); };

  const handleStartAppointment = async (slotId: string) => {
    await updateSlotStatus(slotId, 'em_andamento');
  };

  const handleFinishAppointment = async (slotId: string) => {
    if (finishingSlot === slotId) return;
    setFinishingSlot(slotId);

    try {
      const gerarEvolucao = confirm(
        'Finalizar este atendimento.\n\nDeseja também gerar a evolução agora?'
      );

      if (gerarEvolucao) {
        // 1) tenta descobrir o appointmentId do slot
        const slot = slots.find(s => s.id === slotId);
        const appointmentId = getAppointmentIdFromSlot(slot) ?? slotId;

        // 2) garante que existe encounter para esse agendamento
        const { data: ensuredId, error: ensureErr } = await supabase.rpc(
          'ensure_encounter',
          {
            p_appointment_id: appointmentId,
            p_meta: {
              patientName: (slot as any)?.patientName || (slot as any)?.patient_name || undefined,
              professionalName:
                professionals?.find(p => p.id === (slot as any)?.professionalId || p.id === (slot as any)?.professional_id)?.name ||
                (slot as any)?.professionalName ||
                (slot as any)?.professional_name ||
                undefined,
              serviceName: (slot as any)?.service || (slot as any)?.serviceName || (slot as any)?.service_name || undefined,
            },
          }
        );
        if (ensureErr) throw ensureErr;

        // 3) finaliza (congela nota e fecha encontro/agenda base)
        const { error: finErr } = await supabase.rpc('finalize_encounter', {
          p_encounter_id: ensuredId as string,
        });
        if (finErr) throw finErr;
      }

      // 4) marca o SLOT como concluído na sua agenda (sempre)
      await updateSlotStatus(slotId, 'concluido');

      // 5) notifica outras telas (ex.: LiveEncounter já fecha e dispara também)
      
    } catch (err) {
      console.warn(err);
      alert('Não foi possível concluir. Tente novamente.');
    } finally {
      setFinishingSlot(null);
    }
  };

  const handleCancelAppointment = async (slotId: string) => {
    if (confirm('Tem certeza que deseja cancelar este atendimento?')) {
      await updateSlotStatus(slotId, 'cancelado');
    }
  };
  const handleMarkNoShow = async (slotId: string) => {
    if (confirm('Marcar como faltou?')) {
      await updateSlotStatus(slotId, 'no_show');
    }
  };

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando atendimentos...</div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* FAB “+” */}
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed right-20 top-4 z-20 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
        title="Criar jornada"
        aria-label="Criar jornada"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Atendimentos</h1>
      </div>

      {/* Agenda */}
      <KanbanAgenda
        professionals={professionalsForKanban as any}
        journeys={visibleJourneys}
        slots={filteredSlots}
        onSchedulePatient={handleSchedulePatient}
        onEditPatient={handleEditPatient}
        onStartAppointment={handleStartAppointment}
        onFinishAppointment={handleFinishAppointment}
        onCancel={handleCancelAppointment}
        onNoShow={handleMarkNoShow}
        onEditJourney={handleEditJourney}
        onDeleteJourney={handleDeleteJourney}
        sortSlotsByTime={sortSlotsByTime}
        // Se o componente aceitar, você pode passar:
        // onOpenProntuario={handleOpenProntuarioFromSlot}
      />

      {/* Modais */}
      <CreateJourneyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createJourney}
        professionals={professionals}
      />
      <EditJourneyModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedJourney(null); }}
        onUpdate={updateJourney}
        journey={selectedJourney}
        professionals={professionals}
      />
      <SchedulePatientModal
        isOpen={isScheduleModalOpen}
        onClose={() => { setIsScheduleModalOpen(false); setSelectedSlot(null); }}
        onSchedule={handleConfirmSchedulePatient}
        slot={selectedSlot}
        patients={patients}
      />
      <EditPatientModal
        isOpen={isEditPatientModalOpen}
        onClose={() => { setIsEditPatientModalOpen(false); setSelectedSlot(null); }}
        onUpdate={handleUpdatePatient}
        slot={selectedSlot}
        patients={patients}
      />
      <AppointmentHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        onCreated={() => setIsAddPatientOpen(false)}
      />
    </div>
  );
};

export default Schedule;
