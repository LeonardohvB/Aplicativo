// src/components/Schedule/CreateJourneyModal.tsx
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Professional } from '../../types';

interface CreateJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (journey: {
    professionalId: string;
    professionalName: string;
    date: string;          // yyyy-mm-dd
    startTime: string;     // HH:mm
    endTime: string;       // HH:mm
    consultationDuration: number; // Fixo: 40 (não exibido)
    bufferDuration: number;       // Fixo: 10 (não exibido)
    defaultPrice: number;
    clinicPercentage: number;
  }) => void;
  professionals: Professional[];
}

/* ===== Helpers (LOCAL, sem UTC) ===== */
const isTime = (t: string) => /^\d{2}:\d{2}$/.test(t);
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toYmdLocal = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const nowHHmm = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
};
const parseYmd = (ymd: string) => {
  const [y, m, d] = String(ymd || '').slice(0, 10).split('-').map(Number);
  return { y, m: (m ?? 1) - 1, d: d ?? 1 };
};
const isSameLocalDay = (ymd: string, d: Date = new Date()) => {
  const { y, m, d: day } = parseYmd(ymd);
  return (
    y === d.getFullYear() &&
    m === d.getMonth() &&
    day === d.getDate()
  );
};

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
    // estes ficam “escondidos” (não renderizamos inputs)
    consultationDuration: '40',
    bufferDuration: '10',
    defaultPrice: '',
    clinicPercentage: '20',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);

  const selectedProfessional = useMemo(
    () => professionals.find(p => p.id === formData.professionalId),
    [professionals, formData.professionalId]
  );

  if (!isOpen) return null;

  const setField =
    (name: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFormData(s => ({ ...s, [name]: e.target.value }));
      if (errors[name]) setErrors(er => ({ ...er, [name]: '' }));
    };

  function validate() {
    const e: Record<string, string> = {};

    if (!formData.professionalId) e.professionalId = 'Selecione um profissional.';
    if (!formData.date) e.date = 'Informe a data.';

    if (!isTime(formData.startTime)) e.startTime = 'Hora inválida.';
    if (!isTime(formData.endTime)) e.endTime = 'Hora inválida.';
    if (isTime(formData.startTime) && isTime(formData.endTime)) {
      if (toMinutes(formData.endTime) <= toMinutes(formData.startTime)) {
        e.endTime = 'Hora final deve ser maior que a inicial.';
      }
    }

    // se a data é HOJE (local), a hora inicial não pode estar no passado
    if (formData.date && isSameLocalDay(formData.date) && isTime(formData.startTime)) {
      if (formData.startTime < nowHHmm()) {
        e.startTime = 'Não é possível iniciar no passado (hoje).';
      }
    }

    const price = Number(String(formData.defaultPrice).replace(',', '.'));
    if (!(price > 0)) e.defaultPrice = 'Preço deve ser maior que zero.';

    const cp = Number(formData.clinicPercentage);
    if (Number.isNaN(cp) || cp < 0 || cp > 100) e.clinicPercentage = 'Use um valor entre 0 e 100.';

    return e;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eMap = validate();
    if (Object.keys(eMap).length) {
      setErrors(eMap);
      setShake(true);
      setTimeout(() => setShake(false), 260);
      return;
    }

    if (!selectedProfessional) {
      setErrors(er => ({ ...er, professionalId: 'Profissional não encontrado.' }));
      setShake(true);
      setTimeout(() => setShake(false), 260);
      return;
    }

    onCreate({
      professionalId: formData.professionalId,
      professionalName: selectedProfessional.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      consultationDuration: parseInt(formData.consultationDuration, 10), // 40
      bufferDuration: parseInt(formData.bufferDuration, 10),             // 10
      defaultPrice: Number(String(formData.defaultPrice).replace(',', '.')),
      clinicPercentage: Number(formData.clinicPercentage),
    });

    setFormData({
      professionalId: '',
      date: '',
      startTime: '',
      endTime: '',
      consultationDuration: '40',
      bufferDuration: '10',
      defaultPrice: '',
      clinicPercentage: '20',
    });
    setErrors({});
    onClose();
  };

  const err = (k: keyof typeof errors) => !!errors[k];
  const msg = (k: keyof typeof errors) => errors[k];

  const inputClass = (hasError: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto ${shake ? 'animate-shake' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Agendamento</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profissional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profissional *</label>
            <select
              name="professionalId"
              value={formData.professionalId}
              onChange={setField('professionalId')}
              className={inputClass(err('professionalId'))}
              aria-invalid={err('professionalId')}
            >
              <option value="">Selecione um profissional</option>
              {professionals.filter(p => p.isActive).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.specialty}
                </option>
              ))}
            </select>
            {msg('professionalId') && <p className="mt-1 text-xs text-red-600">{msg('professionalId')}</p>}
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={setField('date')}
              min={toYmdLocal(new Date())}  
              className={inputClass(err('date'))}
              aria-invalid={err('date')}
            />
            {msg('date') && <p className="mt-1 text-xs text-red-600">{msg('date')}</p>}
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hora Inicial *</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={setField('startTime')}
                className={inputClass(err('startTime'))}
                aria-invalid={err('startTime')}
              />
              {msg('startTime') && <p className="mt-1 text-xs text-red-600">{msg('startTime')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hora Final *</label>
              <input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={setField('endTime')}
                className={inputClass(err('endTime'))}
                aria-invalid={err('endTime')}
              />
              {msg('endTime') && <p className="mt-1 text-xs text-red-600">{msg('endTime')}</p>}
            </div>
          </div>

          {/* Preço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preço da Consulta (R$) *</label>
            <input
              type="number"
              name="defaultPrice"
              value={formData.defaultPrice}
              onChange={setField('defaultPrice')}
              step="0.01"
              min="0"
              placeholder="130.00"
              className={inputClass(err('defaultPrice'))}
              aria-invalid={err('defaultPrice')}
            />
            {msg('defaultPrice') && <p className="mt-1 text-xs text-red-600">{msg('defaultPrice')}</p>}
          </div>

          {/* Percentual da Clínica */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Porcentagem da Clínica (%) *</label>
            <input
              type="number"
              name="clinicPercentage"
              value={formData.clinicPercentage}
              onChange={setField('clinicPercentage')}
              min="0"
              max="100"
              step="0.1"
              placeholder="20"
              className={inputClass(err('clinicPercentage'))}
              aria-invalid={err('clinicPercentage')}
            />
            {msg('clinicPercentage') ? (
              <p className="mt-1 text-xs text-red-600">{msg('clinicPercentage')}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Clínica: {formData.clinicPercentage}% | Profissional: {Math.max(0, 100 - (Number(formData.clinicPercentage) || 0))}%
              </p>
            )}
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
