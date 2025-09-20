// src/components/Professionals/AddProfessionalModal.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { titleAllWordsLive, titleAllWordsFinal } from '../../lib/strings'; // ⬅️ importe aqui

interface AddProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (professional: {
    name: string;
    specialty: string;
    phone: string;             // apenas dígitos
    registrationCode: string;  // "SIGLA - número"
    commissionRate?: number;
  }) => void;
}

/* Helpers de telefone */
function onlyDigits(v: string) { return (v || '').replace(/\D+/g, ''); }
function formatBRCell(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  const len = d.length;
  if (len === 0) return '';
  if (len <= 2) return `(${d}`;
  if (len <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}
const isValidCell = (v: string) => onlyDigits(v).length === 11;

/* Conselhos */
const COUNCILS = ['CRM','CREA','CREFITO','CRP','CRO','COREN','CRF','CRFa','CRN','CRESS','CREF'];

export default function AddProfessionalModal({
  isOpen,
  onClose,
  onAdd,
}: AddProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');

  // Registro (sigla + número)
  const [council, setCouncil] = useState<string>('CRM');
  const [customCouncil, setCustomCouncil] = useState('');
  const [regNumber, setRegNumber] = useState('');

  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  const [errors, setErrors] = useState<{name?:string; specialty?:string; phone?:string; regNumber?:string; customCouncil?:string}>({});
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setName(''); setSpecialty(''); setPhone('');
      setCouncil('CRM'); setCustomCouncil(''); setRegNumber('');
      setCommissionRate(''); setErrors({});
      setShake(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!name.trim()) nextErrors.name = 'Informe o nome.';
    if (!specialty.trim()) nextErrors.specialty = 'Informe a profissão/especialidade.';

    const phoneDigits = onlyDigits(phone);
    if (phoneDigits.length !== 11) nextErrors.phone = 'Telefone celular deve ter 11 dígitos (DDD + 9).';

    const chosenCouncil = council === 'OUTRO'
      ? (customCouncil || '').trim().toUpperCase()
      : council.toUpperCase();
    if (council === 'OUTRO' && !chosenCouncil) nextErrors.customCouncil = 'Informe a sigla do conselho.';
    if (!regNumber.trim()) nextErrors.regNumber = 'Informe o número do registro.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShake(true);
      setTimeout(() => setShake(false), 260);
      return;
    }

    const registrationCode = `${chosenCouncil} - ${regNumber.trim()}`;

    onAdd({
      name: name.trim(),
      specialty: specialty.trim(),
      phone: phoneDigits, // só dígitos
      registrationCode,
      commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`w-full max-w-md rounded-xl bg-white p-5 shadow-xl ${shake ? 'animate-shake' : ''}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adicionar profissional</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
  value={name}
  onChange={(e) => setName(titleAllWordsLive(e.target.value))}
  onBlur={() => setName((v) => titleAllWordsFinal(v))}
  className="mt-1 w-full rounded-lg border px-3 py-2"
  placeholder="Nome do profissional"
  required
/>
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          {/* Especialidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
  value={specialty}
  onChange={(e) => setSpecialty(titleAllWordsLive(e.target.value))}
  onBlur={() => setSpecialty((v) => titleAllWordsFinal(v))}
  className="mt-1 w-full rounded-lg border px-3 py-2"
  placeholder="Profissão/Especialidade"
  required
/>
            {errors.specialty && <p className="mt-1 text-xs text-red-600">{errors.specialty}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone (celular)</label>
            <input
              value={phone}
              onChange={(e) => { setPhone(formatBRCell(e.target.value)); if (errors.phone) setErrors(s => ({...s, phone: undefined})); }}
              type="tel"
              inputMode="numeric"
              placeholder="(81) 9 9999-9999"
              className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2
                ${(phone && !isValidCell(phone)) || errors.phone
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'}`}
              aria-invalid={(phone && !isValidCell(phone)) || !!errors.phone}
            />
            <p className={`mt-1 text-xs ${ (phone && !isValidCell(phone)) || errors.phone ? 'text-red-600' : 'text-transparent'}`}>
              Informe 11 dígitos (DDD + 9).
            </p>
          </div>

          {/* Registro Profissional */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Registro Profissional (obrigatório)</label>

            <div className="mt-1 flex gap-2">
              <select
                value={council}
                onChange={(e) => { setCouncil(e.target.value); if (errors.customCouncil) setErrors(s => ({...s, customCouncil: undefined})); }}
                className="w-[44%] rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              >
                {COUNCILS.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="OUTRO">Outro…</option>
              </select>

              {council === 'OUTRO' && (
                <input
                  value={customCouncil}
                  onChange={(e) => { setCustomCouncil(e.target.value.toUpperCase()); if (errors.customCouncil) setErrors(s => ({...s, customCouncil: undefined})); }}
                  placeholder="Sigla (ex.: CRM)"
                  className={`w-[30%] rounded-lg border px-3 py-2 focus:outline-none focus:ring-2
                    ${errors.customCouncil ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'}`}
                  aria-invalid={!!errors.customCouncil}
                />
              )}

              <input
                value={regNumber}
                onChange={(e) => { setRegNumber(e.target.value); if (errors.regNumber) setErrors(s => ({...s, regNumber: undefined})); }}
                placeholder="número (ex.: 26465 / SP)"
                className={`flex-1 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2
                  ${errors.regNumber ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'}`}
                aria-invalid={!!errors.regNumber}
              />
            </div>

            {(errors.customCouncil || errors.regNumber) && (
              <p className="mt-1 text-xs text-red-600">
                {errors.customCouncil ?? errors.regNumber}
              </p>
            )}

            <div className="mt-1 text-xs text-gray-500">
              Pré-visualização:{' '}
              <span className="font-medium text-gray-700">
                {(council === 'OUTRO' ? (customCouncil || '').toUpperCase() : council.toUpperCase()) || '—'} - {regNumber || '—'}
              </span>
            </div>
          </div>

          {/* Comissão */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Comissão (%) <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              value={commissionRate}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') return setCommissionRate('');
                const n = Number(v);
                if (!Number.isNaN(n)) setCommissionRate(n);
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
              placeholder="20"
              inputMode="numeric"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
