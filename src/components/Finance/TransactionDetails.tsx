import React from 'react';
import {
  Tag, Calendar, User, Briefcase, CreditCard, CheckCircle2, Clock3, StickyNote
} from 'lucide-react';

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
  // título costuma ser “Atendimento - {Profissional}”
  const firstLine = (t.description || '').split('\n')[0] ?? '';
  const m = firstLine.match(/Atendimento\s*-\s*(.+)$/i);
  return m?.[1]?.trim();
}

function extractPatient(desc?: string): string | undefined {
  if (!desc) return undefined;
  const m = desc.match(/Atendimento\s*-\s*(.+?)\s*\((.+?)\)/i);
  // pelo padrão usado antes: group 1 -> paciente, group 2 -> serviço
  return m?.[1]?.trim();
}

function extractService(desc?: string): string | undefined {
  if (!desc) return undefined;
  const m = desc.match(/\((.+)\)\s*$/);
  return m?.[1]?.trim();
}

const Badge: React.FC<{ children: React.ReactNode; tone: 'green' | 'amber' }> = ({ children, tone }) => (
  <span
    className={
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ' +
      (tone === 'green'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : 'bg-amber-50 text-amber-700 ring-amber-200')
    }
  >
    {tone === 'green' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
    {children}
  </span>
);

const Row: React.FC<{ icon: React.ReactNode; label: string; children?: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="flex items-start gap-3">
    <div className="mt-0.5 text-slate-400">{icon}</div>
    <div>
      <div className="text-[12px] text-slate-500">{label}</div>
      <div className="text-[14px] text-slate-800 font-medium">{children ?? <span className="text-slate-400">—</span>}</div>
    </div>
  </div>
);

type Props = {
  tx: Tx;
  onUpdateStatus?: (id: string, next: TxStatus) => void;
};

const TransactionDetails: React.FC<Props> = ({ tx, onUpdateStatus }) => {
  const professional = extractProfessional(tx);
  const patient = tx.patientName ?? extractPatient(tx.description);
  const service = tx.service ?? extractService(tx.description);

  const status = (tx.status ?? 'paid') as TxStatus;
  const paidAt = tx.paidAt ? new Date(tx.paidAt) : null;
  const paidAtFmt = paidAt
    ? paidAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : undefined;

  return (
    <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Row icon={<Tag className="w-4 h-4" />} label="Categoria">
          {tx.category || '—'}
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

        <Row icon={<CreditCard className="w-4 h-4" />} label="Pagamento">
          <div className="flex items-center gap-2">
            {status === 'paid' ? <Badge tone="green">Pago</Badge> : <Badge tone="amber">Pendente</Badge>}
            {onUpdateStatus && (
              status === 'paid' ? (
                <button
                  className="px-2 py-1 text-[11px] rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                  onClick={() => onUpdateStatus(tx.id, 'pending')}
                >
                  Estornar
                </button>
              ) : (
                <button
                    className="px-2 py-1 text-[11px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                    onClick={() => onUpdateStatus(tx.id, 'paid')}
                >
                  Pagar
                </button>
              )
            )}
          </div>
          <div className="mt-1 text-[12px] text-slate-500">
            {tx.paymentMethod ? `Método: ${tx.paymentMethod}` : 'Método: —'}
            {paidAtFmt ? ` • Pago em: ${paidAtFmt}` : ''}
          </div>
        </Row>

        <Row icon={<StickyNote className="w-4 h-4" />} label="Observações">
          {tx.notes || '—'}
        </Row>
      </div>
    </div>
  );
};

export default TransactionDetails;
