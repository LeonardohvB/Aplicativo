import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Professional } from '../../types';

interface CreateJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (journey: {
    professionalId: string;
    professionalName: string;
    date: string;
    startTime: string;
    endTime: string;
    consultationDuration: number;
    bufferDuration: number;
    defaultPrice: number;
    defaultService: string;
    clinicPercentage: number;
  }) => void;
  professionals: Professional[];
}

const CreateJourneyModal: React.FC<CreateJourneyModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  professionals,
}) => {
  const [formData, setFormData] = useState({
    professionalId: '',
    date: '',
    startTime: '',
    endTime: '',
    consultationDuration: '40',
    bufferDuration: '10',
    defaultPrice: '',
    defaultService: 'Consulta',
    clinicPercentage: '20',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.professionalId || !formData.date || !formData.startTime || !formData.endTime || !formData.defaultPrice || !formData.clinicPercentage) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Validar se hora final é posterior à hora inicial
    if (formData.startTime >= formData.endTime) {
      alert('A hora final deve ser posterior à hora inicial');
      return;
    }

    // Validar se é hoje e o horário não é anterior ao atual
    const today = new Date().toISOString().split('T')[0];
    if (formData.date === today) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (formData.startTime < currentTime) {
        alert('Não é possível agendar para um horário que já passou hoje');
        return;
      }
    }

    const selectedProfessional = professionals.find(p => p.id === formData.professionalId);
    if (!selectedProfessional) {
      alert('Profissional não encontrado');
      return;
    }

    onCreate({
      professionalId: formData.professionalId,
      professionalName: selectedProfessional.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      consultationDuration: parseInt(formData.consultationDuration),
      bufferDuration: parseInt(formData.bufferDuration),
      defaultPrice: parseFloat(formData.defaultPrice),
      defaultService: formData.defaultService,
      clinicPercentage: parseFloat(formData.clinicPercentage),
    });

    setFormData({
      professionalId: '',
      date: '',
      startTime: '',
      endTime: '',
      consultationDuration: '40',
      bufferDuration: '10',
      defaultPrice: '',
      defaultService: 'Consulta',
      clinicPercentage: '20',
    });
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Criar Jornada de Atendimento</h2>
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
              {professionals.filter(p => p.isActive).map(professional => (
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
              Serviço Padrão
            </label>
            <input
              type="text"
              name="defaultService"
              value={formData.defaultService}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Consulta"
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
              Clínica: {formData.clinicPercentage}% | Profissional: {100 - parseFloat(formData.clinicPercentage || '0')}%
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
              Criar Jornada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateJourneyModal;