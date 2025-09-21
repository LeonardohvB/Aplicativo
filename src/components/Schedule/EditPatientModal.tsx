// src/components/Schedule/EditPatientModal.tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AppointmentSlot, Patient } from '../../types';
import { supabase } from '../../lib/supabase';
import { titleAllWordsLive, titleAllWordsFinal } from '../../lib/strings';

/* =============== Helpers de formatação/validação =============== */
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');

const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
};

const isValidCPF = (cpfMasked: string) => {
  const str = onlyDigits(cpfMasked);
  if (!str || str.length !== 11 || /^(\d)\1+$/.test(str)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(str[i]) * (10 - i);
  let d1 = 11 - (s % 11); if (d1 >= 10) d1 = 0;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(str[i]) * (11 - i);
  let d2 = 11 - (s % 11); if (d2 >= 10) d2 = 0;
  return d1 === parseInt(str[9]) && d2 === parseInt(str[10]);
};

const formatCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
};
const isValidCell = (v: string) => onlyDigits(v).length === 11;

/* ========================== Componente ========================== */
interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    slotId: string,
    patientData: { patientName: string; patientPhone: string; service: string; notes?: string }
  ) => void;
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
  const [cpf, setCPF] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [service, setService] = useState('');
  const [notes, setNotes] = useState('');
  const [foundMsg, setFoundMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);

  /* Ao abrir, preenche TUDO a partir do slot. (Sem useMemo → menos chance de “correr” vazio.) */
  useEffect(() => {
    if (!slot || !isOpen) return;
    const rawCpf =
      (slot as any).patientCpf ??
      (slot as any).patient_cpf ??
      (slot as any).cpf ??
      '';
    setCPF(formatCPF(String(rawCpf || '')));
    setPatientName(slot.patientName || '');
    setPatientPhone(formatCell(slot.patientPhone || ''));
    setService(slot.service || '');
    setNotes(slot.notes || '');
    setErrors({});
    setShake(false);
    setFoundMsg(null);
  }, [slot, isOpen]);

  /* lookup por CPF (cache local → supabase) */
  const lookupByCPF = async (masked: string) => {
    const digits = onlyDigits(masked);
    if (digits.length !== 11 || !isValidCPF(masked)) {
      setFoundMsg(null);
      return;
    }

    // 1) local
    const pLocal = patients.find((p: any) => onlyDigits(p.cpf || '') === digits);
    if (pLocal) {
      setPatientName(titleAllWordsFinal(pLocal.name || ''));
      setPatientPhone(formatCell(pLocal.phone || ''));
      setFoundMsg('Paciente carregado do cache local.');
      return;
    }

    // 2) Supabase
    try {
      setLoadingLookup(true);
      const { data, error } = await supabase
        .from('patients')
        .select('name, phone, cpf')
        .eq('cpf', digits)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPatientName(titleAllWordsFinal(data.name || ''));
        setPatientPhone(formatCell(data.phone || ''));
        setFoundMsg('Paciente encontrado no banco.');
      } else {
        setFoundMsg('CPF não cadastrado.');
      }
    } catch {
      setFoundMsg('Erro ao buscar CPF.');
    } finally {
      setLoadingLookup(false);
    }
  };

  /* dispara busca automática quando CPF ficar válido */
  useEffect(() => {
    if (!isOpen) return;
    const d = onlyDigits(cpf);
    if (d.length < 11) { setFoundMsg(null); return; }
    if (!isValidCPF(cpf)) { setFoundMsg('CPF inválido.'); return; }

    const t = setTimeout(() => lookupByCPF(cpf), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpf, isOpen]);

  const inputClass = (bad: boolean) =>
    `w-full px-3 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
      bad
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
    }`;

  function validate() {
    const e: Record<string, string> = {};
    // CPF continua opcional aqui (como estava antes). Se quiser obrigatório, mude esta linha:
    if (cpf && !isValidCPF(cpf)) e.cpf = 'CPF inválido.';
    if (!patientName.trim()) e.patientName = 'Informe o nome do paciente.';
    if (!isValidCell(patientPhone)) e.patientPhone = 'Telefone deve ter 11 dígitos (DDD + 9).';
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
    if (!slot) return;

    onUpdate(slot.id, {
      patientName: patientName.trim(),
      patientPhone: onlyDigits(patientPhone),
      service: titleAllWordsFinal(service.trim()),
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  if (!isOpen || !slot) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto ${shake ? 'animate-shake' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Editar Agendamento</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Horário:</strong> {slot.startTime} - {slot.endTime}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* CPF – chave de busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CPF do Paciente</label>
            <input
              value={cpf}
              onChange={(e) => { setCPF(formatCPF(e.target.value)); if (errors.cpf) setErrors(s => ({...s, cpf: ''})); }}
              className={inputClass(!!errors.cpf)}
              placeholder="000.000.000-00"
              inputMode="numeric"
              aria-invalid={!!errors.cpf}
            />
            <div className="mt-1 text-xs">
              {errors.cpf ? (
                <p className="text-red-600">{errors.cpf}</p>
              ) : (
                <p className={foundMsg ? 'text-green-600' : 'text-gray-400'}>
                  {loadingLookup ? 'Buscando...' : (foundMsg || 'Informe o CPF para localizar e preencher automaticamente.')}
                </p>
              )}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Paciente *</label>
            <input
              value={patientName}
              onChange={(e) => { setPatientName(titleAllWordsLive(e.target.value)); if (errors.patientName) setErrors(s => ({...s, patientName: ''})); }}
              onBlur={() => setPatientName(v => titleAllWordsFinal(v))}
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
              onChange={(e) => { setService(titleAllWordsLive(e.target.value)); if (errors.service) setErrors(s => ({...s, service: ''})); }}
              onBlur={() => setService(v => titleAllWordsFinal(v))}
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
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPatientModal;
