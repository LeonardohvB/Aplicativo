// src/components/Professionals/EditProfessionalModal.tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Professional } from '../../types';
import { formatBRCell } from '../../lib/phone-br';

/* ========= helpers ========= */
const onlyDigits = (v: string) => (v || '').replace(/\D+/g, '');

const COUNCILS = [
  'CRM','CREA','CREFITO','CRP','CRO','COREN','CRF','CRFa','CRN','CRESS','CREF','CRMV','CRBM','OUTRO'
];

/** Mapeamento Conselho -> Profissão/Especialidade (auto) */
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

function splitRegistration(s: string | undefined | null) {
  const raw = (s ?? '').trim();
  const m = raw.match(/^\s*([A-Za-zÀ-ÿ]{2,10})\s*-\s*(.+)$/);
  if (m) return { council: m[1], number: m[2] };
  return { council: 'CRM', number: raw };
}

/* ===== Title Case (mesmo do seu arquivo) ===== */
const PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'", "d’"]);
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
function titleCaseFinalize(input: string) {
  const trimmed = input.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  return titleCaseLive(trimmed);
}

/* ========= props ========= */
interface EditProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    id: string,
    professional: {
      name?: string;
      specialty?: string;        // <- enviado automaticamente
      phone?: string;            // <- apenas dígitos
      registrationCode?: string; // <- "SIGLA - número"
      commissionRate?: number;
      isActive?: boolean;
    }
  ) => void;
  onDelete: (id: string) => Promise<void> | void; // (mantido, não usado aqui)
  professional: Professional | null;
}

export default function EditProfessionalModal({
  isOpen,
  onClose,
  onUpdate,
  onDelete: _onDeleteNotUsed,
  professional,
}: EditProfessionalModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState(''); // <- BLOQUEADO (auto)
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | ''>('');

  // Registro
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

  // Preenche estado inicial a partir do profissional
  useEffect(() => {
    if (professional && isOpen) {
      setName(professional.name ?? '');
      setPhone(formatBRCell(professional.phone ?? ''));
      setCommissionRate(
        typeof professional.commissionRate === 'number' ? professional.commissionRate : ''
      );

      const { council: c, number: n } = splitRegistration(professional.registrationCode);
      if (COUNCILS.includes((c || '').toUpperCase())) {
        setCouncil(c.toUpperCase());
        setCustomCouncil('');
      } else {
        setCouncil('OUTRO');
        setCustomCouncil((c || '').toUpperCase());
      }
      setRegNumber(n ?? '');

      // especialidade sempre automática pelo conselho
      const auto = COUNCIL_TO_PROFESSION[(c || '').toUpperCase()] ?? '';
      setSpecialty(auto);
    }
  }, [professional, isOpen]);

  // Quando o conselho mudar, recalcula especialidade automaticamente
  useEffect(() => {
    const auto = COUNCIL_TO_PROFESSION[council] ?? '';
    setSpecialty(auto);
  }, [council]);

  if (!isOpen || !professional) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nameFinal = titleCaseFinalize(name);
    if (!nameFinal) return alert('Nome é obrigatório.');

    const chosenCouncil =
      council === 'OUTRO' ? (customCouncil || '').trim().toUpperCase() : council.toUpperCase();
    if (!chosenCouncil) return alert('Informe a sigla do conselho (ex.: CRM, CREA, CREFITO).');
    if (!regNumber.trim()) return alert('Informe o número do registro.');

    const registrationCode = `${chosenCouncil} - ${regNumber.trim()}`;

    // especialidade vem do mapeamento; se OUTRO, fica vazia mesmo (coerente com "Adicionar")
    const autoSpecialty = COUNCIL_TO_PROFESSION[council] ?? '';

    onUpdate(professional.id, {
      name: nameFinal,
      specialty: autoSpecialty,
      phone: onlyDigits(phone),            // envia apenas dígitos
      registrationCode,
      commissionRate: commissionRate === '' ? undefined : Number(commissionRate),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
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
              placeholder="(81) 9 9999-9999"
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
                {(council === 'OUTRO' ? (customCouncil || '').toUpperCase() : council.toUpperCase()) || '—'} - {regNumber || '—'}
              </span>
            </div>
          </div>

          {/* Profissão/Especialidade — BLOQUEADO e automático */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissão/Especialidade</label>
            <input
              value={specialty}
              readOnly
              disabled
              className="mt-1 w-full rounded-lg border px-3 py-2 bg-gray-100 text-gray-700 cursor-not-allowed"
              placeholder="Preenchido automaticamente pelo registro"
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
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>

      {/* keyframes das animações inline usadas acima */}
      <style>{`
        @keyframes zoomIn { 0% { transform: scale(.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}
