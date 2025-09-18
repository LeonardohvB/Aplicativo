// src/components/Professionals/EditProfessionalModal.tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Professional } from '../../types';
import { formatBRCell } from '../../lib/phone-br';

interface EditProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    id: string,
    professional: {
      name?: string;
      specialty?: string;
      phone?: string;
      registrationCode?: string; // montado como "SIGLA - número"
      commissionRate?: number;
      isActive?: boolean;
    }
  ) => void;
  onDelete: (id: string) => Promise<void> | void;
  professional: Professional | null;
}

// opções de conselhos mais comuns (adicione/retire à vontade)
const COUNCILS = [
  'CRM', 'CREA', 'CREFITO', 'CRP', 'CRO', 'COREN', 'CRF', 'CRFa', 'CRN', 'CRESS', 'CREF',
];

// helper: separa "SIGLA - número" em { council, number }
function splitRegistration(s: string | undefined | null) {
  const raw = (s ?? '').trim();
  const m = raw.match(/^\s*([A-Za-zÀ-ÿ]{2,10})\s*-\s*(.+)$/);
  if (m) return { council: m[1], number: m[2] };
  // se vier só o número, assume CRM por padrão
  return { council: 'CRM', number: raw };
}

export default function EditProfessionalModal({
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  professional,
}: EditProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');

  // novo: estados para o registro
  const [council, setCouncil] = useState<string>('CRM');  // sigla escolhida
  const [customCouncil, setCustomCouncil] = useState(''); // quando "Outro"
  const [regNumber, setRegNumber] = useState('');         // número/sufixo

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (professional && isOpen) {
      setName(professional.name ?? '');
      setSpecialty(professional.specialty ?? '');
      setPhone(formatBRCell(professional.phone ?? ''));
      setCommissionRate(
        typeof professional.commissionRate === 'number' ? professional.commissionRate : ''
      );

      // preencher conselho + número a partir do campo atual
      const { council: c, number: n } = splitRegistration(professional.registrationCode);
      // se a sigla não está na lista, marcamos como "Outro"
      if (COUNCILS.includes(c.toUpperCase())) {
        setCouncil(c.toUpperCase());
        setCustomCouncil('');
      } else {
        setCouncil('OUTRO');
        setCustomCouncil(c.toUpperCase());
      }
      setRegNumber(n ?? '');
      setDeleting(false);
    }
  }, [professional, isOpen]);

  if (!isOpen || !professional) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Nome é obrigatório.');
    if (!specialty.trim()) return alert('Profissão/Especialidade é obrigatória.');
    const chosenCouncil =
      council === 'OUTRO'
        ? (customCouncil || '').trim().toUpperCase()
        : council.toUpperCase();
    if (!chosenCouncil) return alert('Informe a sigla do conselho (ex.: CRM, CREA, CREFITO).');
    if (!regNumber.trim()) return alert('Informe o número do registro.');

    const registrationCode = `${chosenCouncil} - ${regNumber.trim()}`;

    onUpdate(professional.id, {
      name,
      specialty,
      phone,
      registrationCode,
      commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
    });
    onClose();
  };

  const handleDelete = async () => {
    const ok = confirm('Tem certeza que deseja excluir este profissional? Esta ação não poderá ser desfeita.');
    if (!ok) return;
    try {
      setDeleting(true);
      await onDelete(professional.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-prof-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-prof-title" className="text-lg font-semibold">Editar profissional</h2>
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
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBRCell(e.target.value))}
              type="tel"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </div>

          {/* --- Registro Profissional (com sigla pronta) --- */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Registro Profissional (obrigatório)
            </label>

            <div className="mt-1 flex gap-2">
              <select
                value={council}
                onChange={(e) => setCouncil(e.target.value)}
                className="w-[44%] rounded-lg border px-3 py-2"
              >
                {COUNCILS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="OUTRO">Outro…</option>
              </select>

              {council === 'OUTRO' && (
                <input
                  value={customCouncil}
                  onChange={(e) => setCustomCouncil(e.target.value.toUpperCase())}
                  placeholder="Sigla (ex.: CRM)"
                  className="w-[30%] rounded-lg border px-3 py-2"
                />
              )}

              <input
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="número (ex.: 26465 / SP)"
                className="flex-1 rounded-lg border px-3 py-2"
              />
            </div>

            <div className="mt-1 text-xs text-gray-500">
              Pré-visualização:{' '}
              <span className="font-medium text-gray-700">
                {(council === 'OUTRO' ? (customCouncil || '').toUpperCase() : council.toUpperCase()) || '—'}{' '}
                - {regNumber || '—'}
              </span>
            </div>
          </div>
          {/* --- /Registro --- */}

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

          {/* Rodapé */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
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
