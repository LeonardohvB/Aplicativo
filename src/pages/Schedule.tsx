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

  // Modal de cadastro rápido de paciente (pode abrir via evento 'patient:new')
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
        // aliases aceitos pelo Kanban
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

  // ✅ Abrir histórico (menu suspenso OU Dashboard)
  useEffect(() => {
    const openHistory = () => setIsHistoryModalOpen(true);

    // pelo menu suspenso
    window.addEventListener('agenda:openHistory', openHistory as EventListener);

    // pelo Dashboard (flag + evento)
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
    const base = (dashboardFilter === 'today' || dashboardFilter === 'week')
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

  /* ===== Ações ===== */
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

  const handleStartAppointment = async (slotId: string) => { await updateSlotStatus(slotId, 'em_andamento'); };

  const handleFinishAppointment = async (slotId: string) => {
    if (finishingSlot === slotId) return;
    setFinishingSlot(slotId);
    try { await updateSlotStatus(slotId, 'concluido'); }
    catch { alert('Não foi possível concluir. Tente novamente.'); }
    finally { setFinishingSlot(null); }
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
