// src/components/Professionals/AddProfessionalModal.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AddProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (professional: {
    name: string;
    specialty: string;
    phone: string;             // será enviado apenas com dígitos
    registrationCode: string;  // obrigatório
    commissionRate?: number;   // opcional
  }) => void;
}

/* ==== Helpers de telefone (inline) ==== */
function onlyDigits(v: string) {
  return (v || '').replace(/\D+/g, '');
}
// Formata celular BR: (DD) X XXXX-XXXX
function formatBRCell(v: string) {
  const d = onlyDigits(v).slice(0, 11); // dd + 9 dígitos
  const len = d.length;
  if (len === 0) return '';
  if (len <= 2) return `(${d}`;
  if (len <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export default function AddProfessionalModal({
  isOpen,
  onClose,
  onAdd,
}: AddProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState(''); // mantém FORMATADO na UI
  const [registrationCode, setRegistrationCode] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setSpecialty('');
      setPhone('');
      setRegistrationCode('');
      setCommissionRate('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Nome é obrigatório.');
    if (!specialty.trim()) return alert('Profissão/Especialidade é obrigatória.');
    if (!registrationCode.trim()) return alert('Registro profissional é obrigatório.');

    const phoneDigits = onlyDigits(phone); // salva apenas dígitos (ex.: 8197...)

    onAdd({
      name,
      specialty,
      phone: phoneDigits,
      registrationCode,
      commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adicionar profissional</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Ex.: Maria Silva"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Ex.: Psicóloga"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBRCell(e.target.value))} // máscara enquanto digita
              type="tel"
              inputMode="numeric"
              placeholder="(81) 9 9999-9999"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Registro Profissional (obrigatório)
            </label>
            <input
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="CRM/CRP/CRFa/CREFFITO..."
              required
            />
          </div>

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
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="20"
              inputMode="numeric"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
