import React, { useState } from 'react';
import { Plus, Edit2, Trash2, History } from 'lucide-react';
import CreateJourneyModal from '../components/Schedule/CreateJourneyModal';
import EditJourneyModal from '../components/Schedule/EditJourneyModal';
import SlotCard from '../components/Schedule/SlotCard';
import SchedulePatientModal from '../components/Schedule/SchedulePatientModal';
import EditPatientModal from '../components/Schedule/EditPatientModal';
import AppointmentHistoryModal from '../components/Schedule/AppointmentHistoryModal';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useProfessionals } from '../hooks/useProfessionals';
import { AppointmentSlot, AppointmentJourney } from '../types';

const Schedule: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<AppointmentJourney | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  const { journeys, slots, patients, loading, createJourney, updateJourney, deleteJourney, schedulePatient, updatePatient, updateSlotStatus } = useAppointmentJourneys();
  const { professionals } = useProfessionals();

  const handleEditJourney = (journeyId: string) => {
    const journey = journeys.find(j => j.id === journeyId);
    if (journey) {
      setSelectedJourney(journey);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (confirm('Tem certeza que deseja excluir esta jornada? Todos os agendamentos serão perdidos.')) {
      await deleteJourney(journeyId);
    }
  };

  const handleSchedulePatient = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot) {
      setSelectedSlot(slot);
      setIsScheduleModalOpen(true);
    }
  };

  const handleEditPatient = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
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

  const handleFinishAppointment = async (slotId: string) => {
    await updateSlotStatus(slotId, 'concluido');
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

  // Agrupar slots por data
  const groupedSlots = slots.reduce((acc, slot) => {
    if (!acc[slot.date]) {
      acc[slot.date] = [];
    }
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, AppointmentSlot[]>);

  // Agrupar jornadas por data para mostrar informações da jornada
  const journeysByDate = journeys.reduce((acc, journey) => {
    if (!acc[journey.date]) {
      acc[journey.date] = [];
    }
    acc[journey.date].push(journey);
    return acc;
  }, {} as Record<string, AppointmentJourney[]>);

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando atendimentos...</div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Atendimentos</h1>
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsHistoryModalOpen(true)}
            className="p-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors shadow-lg"
            title="Ver histórico de atendimentos"
          >
            <History className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {journeys.map((journey) => {
          const journeySlots = slots.filter(slot => slot.journeyId === journey.id);
          
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
                {journeySlots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onSchedulePatient={handleSchedulePatient}
                    onEditPatient={handleEditPatient}
                    onStartAppointment={handleStartAppointment}
                    onFinishAppointment={handleFinishAppointment}
                    onCancelAppointment={handleCancelAppointment}
                    onMarkNoShow={handleMarkNoShow}
                  />
                ))}
              </div>
            </div>
          );
        })}
        
        {journeys.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">Nenhuma jornada de atendimento criada ainda.</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Criar Primeira Jornada
            </button>
          </div>
        )}
      </div>

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
    </div>
  );
};

export default Schedule;