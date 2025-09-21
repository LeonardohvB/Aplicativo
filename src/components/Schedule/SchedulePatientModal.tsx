// src/components/Schedule/SchedulePatientModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AppointmentSlot, Patient } from '../../types';
import { supabase } from '../../lib/supabase'; // opcional: busca no banco se não achar na prop

interface SchedulePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (
    slotId: string,
    patientData: {
      patientName: string;
      patientPhone: string; // só dígitos
      service: string;
      price: number;
      notes?: string;
    }
  ) => void;
  slot: AppointmentSlot | null;
  patients: Patient[];
}

/* ===== Helpers ===== */
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  const L = d.length;
  if (!L) return '';
  if (L <= 3) return d;
  if (L <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (L <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};
const isValidCPF = (cpfMasked: string) => {
  const str = onlyDigits(cpfMasked);
  if (!str || str.length !== 11) return false;
  if (/^(\d)\1+$/.test(str)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(str[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(str[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d1 === parseInt(str[9]) && d2 === parseInt(str[10]);
};

const formatCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  const L = d.length;
  if (!L) return '';
  if (L <= 2) return `(${d}`;
  if (L <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (L <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
const isValidCell = (v: string) => onlyDigits(v).length === 11;

const SchedulePatientModal: React.FC<SchedulePatientModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  slot,
  patients,
}) => {
  const [cpf, setCPF] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [service, setService] = useState('');
  const [notes, setNotes] = useState('');
  const [found, setFound] = useState<null | { name: string; phone?: string }>(null);
  const [searching, setSearching] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);

  // 🔎 timer de debounce para a busca por CPF
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // limpa tudo ao abrir
    setCPF('');
    setFound(null);
    setPatientName('');
    setPatientPhone('');
    setNotes('');
    setErrors({});
    setShake(false);

    setService(slot?.service || 'Consulta');
  }, [isOpen, slot?.id]);

  // limpa o timer quando o componente desmontar
  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  const localFindByCPF = (cpfDigits: string) =>
    patients.find((p) => onlyDigits((p as any).cpf || '') === cpfDigits);

  async function tryAutoFill(cpfMasked: string) {
    const digits = onlyDigits(cpfMasked);
    if (digits.length !== 11 || !isValidCPF(cpfMasked)) {
      setFound(null);
      return;
    }
    // 1) procura na lista passada por props
    const local = localFindByCPF(digits);
    if (local) {
      setFound({ name: local.name, phone: local.phone });
      setPatientName(local.name || '');
      setPatientPhone(formatCell(local.phone || ''));
      return;
    }
    // 2) fallback: busca no supabase (opcional)
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('patients')
        .select('name, phone, cpf')
        .eq('cpf', digits)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setFound({ name: data.name, phone: data.phone });
        setPatientName(data.name || '');
        setPatientPhone(formatCell(data.phone || ''));
      } else {
        setFound(null);
      }
    } catch {
      setFound(null);
    } finally {
      setSearching(false);
    }
  }

  if (!isOpen || !slot) return null;

  const inputClass = (bad: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      bad
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  function validate() {
    const e: Record<string, string> = {};
    if (!isValidCPF(cpf)) e.cpf = 'CPF inválido.';
    if (!patientName.trim()) e.patientName = 'Informe o nome do paciente.';
    if (!isValidCell(patientPhone)) e.patientPhone = 'Telefone deve ter 11 dígitos.';
    if (!service.trim()) e.service = 'Informe o serviço.';
    return e;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    const eMap = validate();
    if (Object.keys(eMap).length) {
      setErrors(eMap);
      setShake(true);
      setTimeout(() => setShake(false), 260);
      return;
    }

    // ✅ Narrowing explícito
    if (!slot) return;

    const { id, price } = slot;

    onSchedule(id, {
      patientName: patientName.trim(),
      patientPhone: onlyDigits(patientPhone),
      service: service.trim(),
      price,
      notes: notes.trim() || undefined,
    });

    onClose();
    setCPF(''); setPatientName(''); setPatientPhone(''); setNotes(''); setFound(null);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto ${shake ? 'animate-shake' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Agendar Paciente</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-indigo-50 text-indigo-700 text-sm px-3 py-2 font-medium">
          Horário: {slot.startTime} - {slot.endTime}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CPF do Paciente *</label>
            <input
              value={cpf}
              onChange={(e) => {
                const v = formatCPF(e.target.value);
                setCPF(v);
                if (errors.cpf) setErrors((s) => ({ ...s, cpf: '' }));

                // 🔎 debounce da busca por CPF conforme digita
                if (searchTimer.current) window.clearTimeout(searchTimer.current);
                searchTimer.current = window.setTimeout(() => {
                  tryAutoFill(v);
                }, 350);
              }}
              className={inputClass(!!errors.cpf)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              aria-invalid={!!errors.cpf}
            />
            <div className="mt-1 text-xs">
              {errors.cpf ? (
                <p className="text-red-600">{errors.cpf}</p>
              ) : searching ? (
                <p className="text-gray-500">Buscando paciente…</p>
              ) : found ? (
                <p className="text-green-600">Paciente encontrado: <b>{found.name}</b></p>
              ) : (
                <p className="text-gray-400">A busca acontece automaticamente ao digitar.</p>
              )}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Paciente *</label>
            <input
              value={patientName}
              onChange={(e) => { setPatientName(e.target.value); if (errors.patientName) setErrors(s => ({...s, patientName: ''})); }}
              className={inputClass(!!errors.patientName)}
              placeholder="Nome completo"
              aria-invalid={!!errors.patientName}
            />
            {errors.patientName && <p className="mt-1 text-xs text-red-600">{errors.patientName}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
            <input
              value={patientPhone}
              onChange={(e) => { setPatientPhone(formatCell(e.target.value)); if (errors.patientPhone) setErrors(s=>({...s, patientPhone:''})); }}
              className={inputClass(!!errors.patientPhone || (!!patientPhone && !isValidCell(patientPhone)))}
              placeholder="(11) 9 9999-9999"
              inputMode="numeric"
              aria-invalid={!!errors.patientPhone || (!!patientPhone && !isValidCell(patientPhone))}
            />
            <p className={`mt-1 text-xs ${errors.patientPhone || (!!patientPhone && !isValidCell(patientPhone)) ? 'text-red-600' : 'text-transparent'}`}>
              Informe 11 dígitos (DDD + 9).
            </p>
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Serviço *</label>
            <input
              value={service}
              onChange={(e) => { setService(e.target.value); if (errors.service) setErrors(s => ({...s, service: ''})); }}
              className={inputClass(!!errors.service)}
              placeholder="Consulta"
              aria-invalid={!!errors.service}
            />
            {errors.service && <p className="mt-1 text-xs text-red-600">{errors.service}</p>}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              placeholder="Observações sobre o atendimento..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancelar
            </button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Agendar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SchedulePatientModal;
