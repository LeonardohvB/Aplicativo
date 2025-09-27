// src/pages/Schedule.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, History } from 'lucide-react';
import { UserPlus } from 'lucide-react';
import CreateJourneyModal from '../components/Schedule/CreateJourneyModal';
import EditJourneyModal from '../components/Schedule/EditJourneyModal';
import SlotCard from '../components/Schedule/SlotCard';
import SchedulePatientModal from '../components/Schedule/SchedulePatientModal';
import EditPatientModal from '../components/Schedule/EditPatientModal';
import AppointmentHistoryModal from '../components/Schedule/AppointmentHistoryModal';
import AddPatientModal from '../components/Patients/AddPatientModal';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useProfessionals } from '../hooks/useProfessionals';
import { AppointmentSlot, AppointmentJourney } from '../types';

// ================= helpers de data/hora (fuso LOCAL) =================

/** data local YYYY-MM-DD (evita voltar 1 dia por causa do UTC) */
const localISODate = (d = new Date()) => {
  const dd = new Date(d);
  dd.setMinutes(dd.getMinutes() - dd.getTimezoneOffset());
  return dd.toISOString().slice(0, 10);
};

/** cria um Date no fuso local a partir de "YYYY-MM-DD" e "HH:MM" */
const toLocalDateTime = (dateISO: string, timeHHMM: string) => {
  const [hh, mm] = timeHHMM.split(':').map(Number);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(hh, mm, 0, 0); // usa fuso local
  return d;
};

type SlotLite = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
};

/** slots: futuros no topo; passados descem; entre iguais, ordem cronológica */
const sortSlotsByTime = (a: SlotLite, b: SlotLite) => {
  const now = new Date();
  const ta = toLocalDateTime(a.date, a.startTime);
  const tb = toLocalDateTime(b.date, b.startTime);

  const aPast = ta < now;
  const bPast = tb < now;
  if (aPast !== bPast) return aPast ? 1 : -1;   // passado vai pro fim
  return ta.getTime() - tb.getTime();           // cronológico
};

/** jornadas: mesmas regras dos slots (considerando o startTime da jornada) */
const sortJourneysByDateTime = (a: AppointmentJourney, b: AppointmentJourney) => {
  const now = new Date();
  const ta = toLocalDateTime(a.date, a.startTime);
  const tb = toLocalDateTime(b.date, b.startTime);

  const aPast = ta < now;
  const bPast = tb < now;
  if (aPast !== bPast) return aPast ? 1 : -1;
  return ta.getTime() - tb.getTime();
};

// ===== helpers de filtro (dashboard -> agenda) =====
const statusVisibleDefault = (status?: string) => {
  const s = (status || '').toLowerCase();
  // visão padrão: mostra "disponível" + "agendado" + "em_andamento"
  return s === 'disponivel' || s === 'available' || s === 'agendado' || s === 'em_andamento';
};

const statusVisiblePeriod = (status?: string) => {
  const s = (status || '').toLowerCase();
  // filtros Hoje/Semana: só o que pode Iniciar/Cancelar
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
// ====================================================================

const Schedule: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<AppointmentJourney | null>(null);

  // 🔒 controla o slot que está concluindo (para bloquear cliques repetidos)
  const [finishingSlot, setFinishingSlot] = useState<string | null>(null);

  const {
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
  } = useAppointmentJourneys();

  const { professionals } = useProfessionals();

  // -------- filtro vindo do dashboard --------
  const [dashboardFilter, setDashboardFilter] = useState<'today' | 'week' | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<'today' | 'week'>).detail;
      setDashboardFilter(detail ?? null);
      // rolar para o topo ao aplicar filtro (UX)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('agenda:filter', handler as EventListener);
    return () => window.removeEventListener('agenda:filter', handler as EventListener);
  }, []);

  useEffect(() => {
  const openHistory = () => setIsHistoryModalOpen(true);
  window.addEventListener('agenda:history', openHistory as EventListener);
  return () => window.removeEventListener('agenda:history', openHistory as EventListener);
}, []);


  const todayStr = localISODate(new Date());
  const { start, end } = startEndOfThisWeek();

  // Semana: queremos começar a contar a partir de AMANHÃ (excluir hoje)
const startTomorrow = new Date();
startTomorrow.setHours(0, 0, 0, 0);
startTomorrow.setDate(startTomorrow.getDate() + 1);


  // slots já filtrados conforme dashboardFilter (ou todos se sem filtro)
 const filteredSlots = useMemo(() => {
  if (!Array.isArray(slots)) return [];

  // base por status:
  // - Hoje/Semana: agendado + em_andamento
  // - Padrão (sem filtro): disponivel + agendado + em_andamento
  const base =
    (dashboardFilter === 'today' || dashboardFilter === 'week')
      ? slots.filter((s) => statusVisiblePeriod(s.status))
      : slots.filter((s) => statusVisibleDefault(s.status));

  if (dashboardFilter === 'today') {
    return base.filter((s) => s.date === todayStr);
  }
 if (dashboardFilter === 'week') {
  // usar T12:00 para não sofrer com fuso
  return base.filter((s) => {
    const d = new Date(`${s.date}T12:00:00`);
    // 👉 começa amanhã e vai até o fim da semana atual
    return d >= startTomorrow && d <= end;
  });
}


  // sem filtro extra: retorna só os “ativos” (inclui disponíveis)
  return base;
}, [slots, dashboardFilter, todayStr, start, end]);


  // renderizamos apenas jornadas que têm ao menos 1 slot visível
  const visibleJourneys = useMemo(() => {
    const ids = new Set(filteredSlots.map((s) => s.journeyId));
    return [...journeys].filter((j) => ids.has(j.id)).sort(sortJourneysByDateTime);
  }, [journeys, filteredSlots]);

  const handleEditJourney = (journeyId: string) => {
    const journey = journeys.find((j) => j.id === journeyId);
    if (journey) {
      setSelectedJourney(journey);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (confirm('Tem certeza que deseja excluir esse agendamento?')) {
      await deleteJourney(journeyId);
    }
  };

  const handleSchedulePatient = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      setSelectedSlot(slot);
      setIsScheduleModalOpen(true);
    }
  };

  const handleEditPatient = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      setSelectedSlot(slot);
      setIsEditPatientModalOpen(true);
    }
  };

  const handleConfirmSchedulePatient = async (slotId: string, patientData: {
    patientName: string;
    patientPhone: string;
    service: string;
    price: number;
    notes?: string;
  }) => {
    await schedulePatient(slotId, patientData);
  };

  const handleUpdatePatient = async (slotId: string, patientData: {
    patientName: string;
    patientPhone: string;
    service: string;
    notes?: string;
  }) => {
    await updatePatient(slotId, patientData);
  };

  const handleStartAppointment = async (slotId: string) => {
    await updateSlotStatus(slotId, 'em_andamento');
  };

  // 🔒 blindado contra cliques repetidos + pronto para usar data local na criação da transação
  const handleFinishAppointment = async (slotId: string) => {
    if (finishingSlot === slotId) return; // já está finalizando este slot

    setFinishingSlot(slotId);
    try {
      // se em algum lugar daqui você cria uma transação,
      // use localISODate() para a data do financeiro (anti-UTC)
      await updateSlotStatus(slotId, 'concluido');
    } catch (err) {
      console.error('Erro ao concluir atendimento:', err);
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
      {/* Cabeçalho ÚNICO com botões no topo direito */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atendimentos</h1>
          {dashboardFilter === 'today' && (
            <p className="text-sm text-gray-500">📅 Filtrando: <b>hoje</b></p>
          )}
          {dashboardFilter === 'week' && (
            <p className="text-sm text-gray-500">📅 Filtrando: <b>semana</b></p>
          )}
        </div>
        <div className="flex space-x-3">
          {/* Histórico */}
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="p-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors shadow-lg"
            title="Ver histórico de atendimentos"
          >
            <History className="w-6 h-6" />
          </button>

          {/* Cadastrar paciente */}
          <button
            onClick={() => setIsAddPatientOpen(true)}
            className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-lg"
            title="Cadastrar paciente"
          >
            <UserPlus className="w-6 h-6" />
          </button>

          {/* Criar jornada */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
            title="Criar jornada"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Listagem */}
      <div className="space-y-6">
        {visibleJourneys.map((journey) => {
          // usa apenas os slots visíveis (já filtrados) desta jornada
          const journeySlots = filteredSlots.filter((slot) => slot.journeyId === journey.id);
          const orderedSlots = [...journeySlots].sort(sortSlotsByTime);

          // usar 12:00 para evitar “voltar/avançar” por UTC
          const formattedDate = new Date(journey.date + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

          return (
            <div key={journey.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 capitalize">{formattedDate}</h2>
                  <p className="text-sm text-gray-600">
                    {journey.professionalName} • {journey.startTime} - {journey.endTime}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditJourney(journey.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar jornada"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteJourney(journey.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir jornada"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orderedSlots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onSchedulePatient={handleSchedulePatient}
                    onEditPatient={handleEditPatient}
                    onStartAppointment={handleStartAppointment}
                    onFinishAppointment={handleFinishAppointment}
                    onCancelAppointment={handleCancelAppointment}
                    onMarkNoShow={handleMarkNoShow}
                    // Se seu SlotCard suportar, dá pra passar `finishing={finishingSlot === slot.id}`
                  />
                ))}
              </div>
            </div>
          );
        })}

        {visibleJourneys.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {dashboardFilter ? 'Nenhum atendimento para este filtro.' : 'Nenhum agendamento criado ainda.'}
            </p>
            {!dashboardFilter && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar agendamento
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      <CreateJourneyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createJourney}
        professionals={professionals}
      />

      <EditJourneyModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedJourney(null);
        }}
        onUpdate={updateJourney}
        journey={selectedJourney}
        professionals={professionals}
      />

      <SchedulePatientModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedSlot(null);
        }}
        onSchedule={handleConfirmSchedulePatient}
        slot={selectedSlot}
        patients={patients}
      />

      <EditPatientModal
        isOpen={isEditPatientModalOpen}
        onClose={() => {
          setIsEditPatientModalOpen(false);
          setSelectedSlot(null);
        }}
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
        onCreated={() => {
          // opcional: toast
          setIsAddPatientOpen(false);
        }}
      />
    </div>
  );
};

export default Schedule;
