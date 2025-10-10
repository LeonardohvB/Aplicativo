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
      registrationCode?: string;
      commissionRate?: number;
      isActive?: boolean;
    }
  ) => void;
  // mantido por compatibilidade, mas a exclusão agora é feita no card (swipe + useConfirm)
  onDelete: (id: string) => Promise<void> | void;
  professional: Professional | null;
}

const COUNCILS = [
  'CRM', 'CREA', 'CREFITO', 'CRP', 'CRO', 'COREN', 'CRF', 'CRFa', 'CRN', 'CRESS', 'CREF',
];

function splitRegistration(s: string | undefined | null) {
  const raw = (s ?? '').trim();
  const m = raw.match(/^\s*([A-Za-zÀ-ÿ]{2,10})\s*-\s*(.+)$/);
  if (m) return { council: m[1], number: m[2] };
  return { council: 'CRM', number: raw };
}

/* ===== Title Case PT-BR ===== */
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'", "d’"]);

// enquanto digita
function titleCaseLive(input: string) {
  const tokens = input.split(/(\s+)/);
  let wordIndex = 0;
  return tokens
    .map((tok) => {
      if (/^\s+$/.test(tok)) return tok;
      const lower = tok.toLowerCase();
      if (wordIndex > 0 && (PARTICLES.has(lower) || PARTICLES.has(lower.replace(/’/g, "'")))) {
        wordIndex++;
        return lower;
      }
      const capped = lower
        .split('-')
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
        .join('-');
      wordIndex++;
      return capped;
    })
    .join('');
}
// no blur/salvar
function titleCaseFinalize(input: string) {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return titleCaseLive(trimmed);
}
/* =========================== */

export default function EditProfessionalModal({
  isOpen,
  onClose,
  onUpdate,
  onDelete: _onDeleteNotUsed, // não usamos aqui
  professional,
}: EditProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');

  const [council, setCouncil] = useState<string>('CRM');
  const [customCouncil, setCustomCouncil] = useState('');
  const [regNumber, setRegNumber] = useState('');

  // ESC fecha + trava o scroll enquanto aberto
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (professional && isOpen) {
      setName(professional.name ?? '');
      setSpecialty(professional.specialty ?? '');
      setPhone(formatBRCell(professional.phone ?? ''));
      setCommissionRate(
        typeof professional.commissionRate === 'number' ? professional.commissionRate : ''
      );

      const { council: c, number: n } = splitRegistration(professional.registrationCode);
      if (COUNCILS.includes(c.toUpperCase())) {
        setCouncil(c.toUpperCase());
        setCustomCouncil('');
      } else {
        setCouncil('OUTRO');
        setCustomCouncil(c.toUpperCase());
      }
      setRegNumber(n ?? '');
    }
  }, [professional, isOpen]);

  if (!isOpen || !professional) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nameFinal = titleCaseFinalize(name);
    const specialtyFinal = titleCaseFinalize(specialty);

    if (!nameFinal) return alert('Nome é obrigatório.');
    if (!specialtyFinal) return alert('Profissão/Especialidade é obrigatória.');

    const chosenCouncil =
      council === 'OUTRO'
        ? (customCouncil || '').trim().toUpperCase()
        : council.toUpperCase();
    if (!chosenCouncil) return alert('Informe a sigla do conselho (ex.: CRM, CREA, CREFITO).');
    if (!regNumber.trim()) return alert('Informe o número do registro.');

    const registrationCode = `${chosenCouncil} - ${regNumber.trim()}`;

    onUpdate(professional.id, {
      name: nameFinal,
      specialty: specialtyFinal,
      phone,
      registrationCode,
      commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop com blur + fade padrão */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] animate-[fadeIn_.18s_ease-out]" />

      {/* Painel */}
      <div
        className="relative w-[92vw] max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/10 animate-[zoomIn_.22s_cubic-bezier(.2,.8,.2,1)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-prof-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="edit-prof-title" className="text-lg font-semibold">Editar profissional</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(titleCaseLive(e.target.value))}
              onBlur={(e) => setName(titleCaseFinalize(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Nome completo"
              required
            />
          </div>

           {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(formatBRCell(e.target.value))}
              type="tel"
              className="mt-1 w-full rounded-lg border px-3 py-2"
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
                placeholder="número (ex.: 02/14676)"
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

          {/* Profissão/Especialidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(titleCaseLive(e.target.value))}
              onBlur={(e) => setSpecialty(titleCaseFinalize(e.target.value))}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Ex.: Psicólogo(a)"
              required
            />
          </div>


          {/* Rodapé — sem botão Excluir (exclusão via swipe do card) */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
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

      {/* Keyframes usados pelas classes animate-[...] */}
      <style>{`
        @keyframes zoomIn {
          0% { transform: scale(.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
