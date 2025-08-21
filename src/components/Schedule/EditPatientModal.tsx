import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AppointmentSlot, Patient } from '../../types';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (slotId: string, patientData: {
    patientName: string;
    patientPhone: string;
    service: string;
    notes?: string;
  }) => void;
  slot: AppointmentSlot | null;
  patients: Patient[];
}

const EditPatientModal: React.FC<EditPatientModalProps> = ({
  isOpen,
  onClose,
  onUpdate,
  slot,
  patients,
}) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    service: '',
    notes: '',
    selectedPatientId: '',
  });

  useEffect(() => {
    if (slot && isOpen) {
      setFormData({
        patientName: slot.patientName || '',
        patientPhone: slot.patientPhone || '',
        service: slot.service,
        notes: slot.notes || '',
        selectedPatientId: slot.patientId || '',
      });
    }
  }, [slot, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.patientName || !formData.service) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (!slot) return;

    onUpdate(slot.id, {
      patientName: formData.patientName,
      patientPhone: formData.patientPhone,
      service: formData.service,
      notes: formData.notes,
    });

    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const patientId = e.target.value;
    setFormData(prev => ({ ...prev, selectedPatientId: patientId }));
    
    if (patientId && patientId !== (slot?.patientId || '')) {
      // Só altera os dados se selecionou um paciente diferente do atual
      const patient = patients.find(p => p.id === patientId);
      if (patient) {
        setFormData(prev => ({
          ...prev,
          patientName: patient.name,
          patientPhone: patient.phone || '',
        }));
      }
    } else if (!patientId) {
      // Se selecionou "Selecionar paciente existente", limpa os campos
      setFormData(prev => ({
        ...prev,
        patientName: '',
        patientPhone: '',
      }));
    }
  };

  if (!isOpen || !slot) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Editar Agendamento</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Horário:</strong> {slot.startTime} - {slot.endTime}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paciente Existente
            </label>
            <select
              value={formData.selectedPatientId}
              onChange={handlePatientSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecionar paciente existente</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.name} {patient.phone && `- ${patient.phone}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Paciente *
            </label>
            <input
              type="text"
              name="patientName"
              value={formData.patientName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nome completo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefone
            </label>
            <input
              type="tel"
              name="patientPhone"
              value={formData.patientPhone}
             onChange={(e) => {
               const inputValue = e.target.value;
               
               // Se o campo está sendo limpo, permite
               if (inputValue === '') {
                 setFormData(prev => ({ ...prev, patientPhone: '' }));
                 return;
               }
               
               const value = inputValue.replace(/\D/g, ''); // Remove tudo que não é dígito
               if (value.length <= 11) { // Limita a 11 dígitos (DDD + 9 dígitos)
                 let formatted = value;
                 if (value.length >= 3) {
                   formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                 }
                 if (value.length >= 7) {
                   formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                 }
                 setFormData(prev => ({ ...prev, patientPhone: formatted }));
               }
             }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(11) 99999-9999"
             maxLength={15}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serviço *
            </label>
            <input
              type="text"
              name="service"
              value={formData.service}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Consulta"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Observações sobre o atendimento..."
            />
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

export default EditPatientModal;