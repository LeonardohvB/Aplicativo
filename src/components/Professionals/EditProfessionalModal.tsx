// src/components/Professionals/EditProfessionalModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Professional } from '../../types';

/* ===== Helpers ===== */
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');
const formatCPF = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  const p1 = d.slice(0, 3), p2 = d.slice(3, 6), p3 = d.slice(6, 9), p4 = d.slice(9, 11);
  if (d.length <= 3)  return p1;
  if (d.length <= 6)  return `${p1}.${p2}`;
  if (d.length <= 9)  return `${p1}.${p2}.${p3}`;
  return `${p1}.${p2}.${p3}-${p4}`;
};
const formatBRCell = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  const len = d.length;
  if (len === 0) return '';
  if (len <= 2)  return `(${d}`;
  if (len <= 3)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (len <= 7)  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};
const isValidCell = (v: string) => onlyDigits(v).length === 11;

/* ===== Conselhos e auto-profissão ===== */
const COUNCIL_TO_PROFESSION: Record<string, string> = {
  CRM: 'Médico(a)',
  CRP: 'Psicólogo(a)',
  CRO: 'Dentista',
  CREFITO: 'Fisioterapeuta',
  CRFa: 'Fonoaudiólogo(a)',
  CRN: 'Nutricionista',
  COREN: 'Enfermeiro(a)',
  CRESS: 'Assistente Social',
  CREF: 'Profissional de Educação Física',
  CRF: 'Farmacêutico(a)',
  CRMV: 'Médico(a) Veterinário(a)',
  CRBM: 'Biomédico(a)',
  CREA: 'Engenheiro(a)',
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  professional: Professional | null;
  onUpdate: (id: string, updates: {
    name?: string;
    specialty?: string;
    phone?: string;
    registrationCode?: string;
    commissionRate?: number;
    isActive?: boolean;
  }) => Promise<void> | void;
  onArchive?: (id: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
};

export default function EditProfessionalModal({
  isOpen,
  onClose,
  professional,
  onUpdate,
  onArchive,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [council, setCouncil] = useState('CRM');
  const [regNumber, setRegNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Deriva council/number a partir do registrationCode existente
  const initialCouncil = useMemo(() => {
    const rc = professional?.registrationCode ?? '';
    const m = rc.match(/^([A-ZÀ-Ú]+)\s*-\s*(.+)$/i);
    return (m?.[1] ?? 'CRM').toUpperCase();
  }, [professional]);
  const initialReg = useMemo(() => {
    const rc = professional?.registrationCode ?? '';
    const m = rc.match(/^([A-ZÀ-Ú]+)\s*-\s*(.+)$/i);
    return (m?.[2] ?? '').trim();
  }, [professional]);

  // Sync ao abrir
  useEffect(() => {
    if (!isOpen || !professional) return;
    setName(professional.name ?? '');
    setPhone(formatBRCell(professional.phone ?? ''));
    setCouncil(initialCouncil);
    setRegNumber(initialReg);
    setErrorMsg('');
    setDeleting(false);
  }, [isOpen, professional, initialCouncil, initialReg]);

  // 🔒 Travar scroll do body enquanto o modal está aberto (inclusive iOS)
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    const prevPos = document.body.style.position;
    document.body.style.overflow = 'hidden';
    // ajuda no iOS para evitar “scroll leak”
    document.body.style.position = 'relative';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.position = prevPos;
    };
  }, [isOpen]);

  if (!isOpen || !professional) return null;

  const specialty = COUNCIL_TO_PROFESSION[council] ?? '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneDigits = onlyDigits(phone);
    if (phone && !isValidCell(phone)) return;

    setSaving(true);
    try {
      await onUpdate(professional.id, {
        name: name.trim() || professional.name,
        phone: phoneDigits,
        registrationCode: `${council.toUpperCase()} - ${regNumber.trim()}`,
        specialty,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setErrorMsg('');
    setDeleting(true);
    try {
      await onDelete(professional.id);
      onClose();
    } catch (e: any) {
      const msg =
        e?.message ||
        e?.error?.message ||
        'Não foi possível excluir. Verifique a conexão/RLS/relacionamentos.';
      setErrorMsg(msg);
      console.error('[delete professional]', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    // Backdrop com scroll próprio e contenção de overscroll (fundo não rola)
    <div
      className="
        fixed inset-0 z-50 bg-black/40 backdrop-blur-sm
        overflow-y-auto overscroll-contain
        p-4
      "
    >
      {/* Wrapper para centralizar e respeitar safe-areas */}
      <div
        className="
          min-h-[100svh] flex items-start justify-center
          pt-[max(12px,env(safe-area-inset-top))]
          pb-[max(12px,env(safe-area-inset-bottom))]
        "
      >
        {/* Card rolável se ficar alto */}
        <div
          className="
            w-full max-w-md rounded-xl bg-white shadow-xl
            max-h-[85svh] overflow-y-auto
            touch-pan-y
          "
        >
          <div className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar profissional</h2>
              <button
                onClick={onClose}
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Fechar"
              >
                <X />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving || deleting}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {/* CPF (somente leitura) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">CPF</label>
                <input
                  value={formatCPF(professional.cpf ?? '')}
                  readOnly
                  disabled
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed"
                  placeholder="—"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Este CPF não pode ser alterado após o cadastro.
                </p>
              </div>

              {/* Telefone */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatBRCell(e.target.value))}
                  disabled={saving || deleting}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ${
                    phone && !isValidCell(phone)
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-300 focus:border-blue-400 focus:ring-blue-200'
                  }`}
                />
              </div>

              {/* Registro Profissional */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Registro Profissional (obrigatório)
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={council}
                    onChange={(e) => setCouncil(e.target.value)}
                    disabled={saving || deleting}
                    className="w-[44%] rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  >
                    {Object.keys(COUNCIL_TO_PROFESSION).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <input
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    disabled={saving || deleting}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    placeholder="número (ex.: 26465 / SP)"
                  />
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  Pré-visualização:{' '}
                  <span className="font-medium text-gray-700">
                    {council.toUpperCase()} - {regNumber || '—'}
                  </span>
                </div>
              </div>

              {/* Profissão/Especialidade — travado */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
                <input
                  value={COUNCIL_TO_PROFESSION[council] ?? ''}
                  readOnly
                  disabled
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Atualizado automaticamente pela sigla do conselho.
                </p>
              </div>

              {/* Erro de exclusão (se houver) */}
              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50"
                  disabled={saving || deleting}
                >
                  Cancelar
                </button>

                {onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(professional.id)}
                    className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800 hover:bg-amber-100"
                    disabled={saving || deleting}
                  >
                    Arquivar
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving || deleting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>

              {onDelete && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100 disabled:opacity-70"
                    disabled={saving || deleting}
                  >
                    {deleting ? 'Excluindo…' : 'Excluir (admin)'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
