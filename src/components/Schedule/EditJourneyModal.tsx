import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AppointmentJourney, Professional } from '../../types';
import { useToast } from '../ui/Toast';

interface EditJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    journeyId: string,
    journey: {
      professionalId: string;
      professionalName: string;
      date: string;
      startTime: string;
      endTime: string;
      consultationDuration: number;
      bufferDuration: number;
      defaultPrice: number;
      clinicPercentage: number;
    }
  ) => void;
  journey: AppointmentJourney | null;
  professionals: Professional[];
}

const EditJourneyModal: React.FC<EditJourneyModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  journey,
  professionals,
}) => {
  const toast = useToast();

  const [formData, setFormData] = useState({
    professionalId: '',
    date: '',
    startTime: '',
    endTime: '',
    consultationDuration: '40',
    bufferDuration: '10',
    defaultPrice: '',
    clinicPercentage: '20',
  });

  useEffect(() => {
    if (journey && isOpen) {
      setFormData({
        professionalId: journey.professionalId,
        date: journey.date,
        startTime: journey.startTime,
        endTime: journey.endTime,
        consultationDuration: journey.consultationDuration.toString(),
        bufferDuration: journey.bufferDuration.toString(),
        defaultPrice: journey.defaultPrice.toString(),
        clinicPercentage: journey.clinicPercentage.toString(),
      });
    }
  }, [journey, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Campos obrigatórios
    if (
      !formData.professionalId ||
      !formData.date ||
      !formData.startTime ||
      !formData.endTime ||
      !formData.defaultPrice ||
      !formData.clinicPercentage
    ) {
      toast.error('Por favor, preencha todos os campos obrigatórios.', {
        title: 'Campos obrigatórios',
      });
      return;
    }

    // Hora final > hora inicial
    if (formData.startTime >= formData.endTime) {
      toast.error('A hora final deve ser posterior à hora inicial.', {
        title: 'Horário inválido',
      });
      return;
    }

    // Hoje: não permitir iniciar no passado
    const todayISO = new Date();
    const today = todayISO.toISOString().split('T')[0];

    if (formData.date === today) {
      const h = todayISO.getHours().toString().padStart(2, '0');
      const m = todayISO.getMinutes().toString().padStart(2, '0');
      const currentTime = `${h}:${m}`;

      if (formData.startTime < currentTime) {
        toast.error('Não é possível agendar para um horário que já passou hoje.', {
          title: 'Horário inválido',
        });
        return;
      }
    }

    if (!journey) return;

    const selectedProfessional = professionals.find(
      (p) => p.id === formData.professionalId
    );
    if (!selectedProfessional) {
      toast.error('Profissional não encontrado.', { title: 'Erro' });
      return;
    }

    onUpdate(journey.id, {
      professionalId: formData.professionalId,
      professionalName: selectedProfessional.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      consultationDuration: parseInt(formData.consultationDuration),
      bufferDuration: parseInt(formData.bufferDuration),
      defaultPrice: parseFloat(formData.defaultPrice),
      clinicPercentage: parseFloat(formData.clinicPercentage),
    });

    toast.success('Jornada atualizada com sucesso!', { title: 'Salvo' });
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen || !journey) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Editar Jornada de Atendimento
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profissional *
            </label>
            <select
              name="professionalId"
              value={formData.professionalId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Selecione um profissional</option>
              {professionals
                .filter((p) => p.isActive)
                .map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name} - {professional.specialty}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Inicial *
              </label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Final *
              </label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço da Consulta (R$) *
            </label>
            <input
              type="number"
              name="defaultPrice"
              value={formData.defaultPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="130.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Porcentagem da Clínica (%) *
            </label>
            <input
              type="number"
              name="clinicPercentage"
              value={formData.clinicPercentage}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="20"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Clínica: {formData.clinicPercentage}% | Profissional:{' '}
              {100 - parseFloat(formData.clinicPercentage || '0')}%
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditJourneyModal;
