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
      registrationCode?: string; // obrigatório
      commissionRate?: number;
      isActive?: boolean;
    }
  ) => void;
  onDelete: (id: string) => Promise<void> | void; // 👈 novo: callback de exclusão
  professional: Professional | null;
}

export default function EditProfessionalModal({
  isOpen,
  onClose,
  onUpdate,
  onDelete,           // 👈 novo
  professional,
}: EditProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  const [deleting, setDeleting] = useState(false); // estado de exclusão

  useEffect(() => {
    if (professional && isOpen) {
      setName(professional.name ?? '');
      setSpecialty(professional.specialty ?? '');
      setPhone(formatBRCell(professional.phone ?? ''));
      setRegistrationCode(professional.registrationCode ?? '');
      setCommissionRate(
        typeof professional.commissionRate === 'number'
          ? professional.commissionRate
          : ''
      );
      setDeleting(false);
    }
  }, [professional, isOpen]);

  if (!isOpen || !professional) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert('Nome é obrigatório.');
    if (!specialty.trim()) return alert('Profissão/Especialidade é obrigatória.');
    if (!registrationCode.trim()) return alert('Registro profissional é obrigatório.');

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
    const ok = confirm(
      'Tem certeza que deseja excluir este profissional? Esta ação não poderá ser desfeita.'
    );
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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Registro Profissional (obrigatório)
            </label>
            <input
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
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

          {/* Rodapé com Cancelar, Excluir e Salvar */}
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
              className="flex-1 rounded-lg  bg-red-400 px-4 py-2 text-black hover:bg-red-50 disabled:opacity-60"
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
