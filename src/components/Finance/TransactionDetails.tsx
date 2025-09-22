// src/components/Finance/TransactionDetails.tsx
import React from 'react';
import { Tag, Calendar, User, Briefcase, StickyNote } from 'lucide-react';

type TxStatus = 'pending' | 'paid';

type Tx = {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category: string;
  professionalId?: string;
  // extras opcionais (podem vir do DB ou não)
  status?: TxStatus | null;
  paymentMethod?: string | null;
  paidAt?: string | null;
  professionalName?: string | null;
  patientName?: string | null;
  service?: string | null;
  notes?: string | null;
};

function extractProfessional(t: Tx): string | undefined {
  if (t.professionalName) return t.professionalName;
  const firstLine = (t.description || '').split('\n')[0] ?? '';
  const m = firstLine.match(/Atendimento\s*-\s*(.+)$/i);
  return m?.[1]?.trim();
}

function extractPatient(desc?: string): string | undefined {
  if (!desc) return undefined;
  const m = desc.match(/Atendimento\s*-\s*(.+?)\s*\((.+?)\)/i);
  return m?.[1]?.trim();
}

function extractService(desc?: string): string | undefined {
  if (!desc) return undefined;
  const m = desc.match(/\((.+)\)\s*$/);
  return m?.[1]?.trim();
}

const Row: React.FC<{ icon: React.ReactNode; label: string; children?: React.ReactNode }> = ({
  icon,
  label,
  children,
}) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-slate-400">{icon}</div>
    <div>
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="text-[14px] text-slate-800 font-medium">
        {children ?? <span className="text-slate-400">—</span>}
      </div>
    </div>
  </div>
);

type Props = {
  tx: Tx;
  /** compatibilidade com Finance.tsx (não é usado aqui) */
  onUpdateStatus?: (id: string, next: TxStatus) => void;
  /** compatibilidade com Finance.tsx (não é usado aqui) */
  hidePayment?: boolean;
};

const TransactionDetails: React.FC<Props> = ({ tx }) => {
  const professional = extractProfessional(tx);
  const patient = tx.patientName ?? extractPatient(tx.description);
  const service = tx.service ?? extractService(tx.description);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Row icon={<Tag className="w-4 h-4" />} label="Categoria">
          {service ?? tx.category ?? '—'}
        </Row>

        <Row icon={<Calendar className="w-4 h-4" />} label="Data">
          {tx.date || '—'}
        </Row>

        <Row icon={<Briefcase className="w-4 h-4" />} label="Profissional">
          {professional || '—'}
        </Row>

        <Row icon={<User className="w-4 h-4" />} label="Paciente">
          {patient || '—'}
        </Row>

        <Row icon={<Tag className="w-4 h-4" />} label="Serviço">
          {service || '—'}
        </Row>
      </div>

      <div className="grid grid-cols-1">
        <Row icon={<StickyNote className="w-4 h-4" />} label="Observações">
          {tx.notes || '—'}
        </Row>
      </div>
    </div>
  );
};

export default TransactionDetails;
