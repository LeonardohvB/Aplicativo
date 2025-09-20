// src/pages/Finance.tsx
import React, { useMemo, useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Wallet,
  CreditCard,
  Calendar,
  Tag,
  User,
  Clock,
} from 'lucide-react';
import TransactionCard from '../components/Finance/TransactionCard';
import AddTransactionModal from '../components/Finance/AddTransactionModal';
import EditTransactionModal from '../components/Finance/EditTransactionModal';
import { useTransactions } from '../hooks/useTransactions';
import { Transaction } from '../types';

/* ====================== SPARKLINE (saldo acumulado) ====================== */
type Pt = { x: number; y: number };

function catmullToBezier(points: Pt[]): string {
  if (points.length < 2) return `M0,110 C150,110 300,110 600,110`;
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/* ====================== Número animado (estável) + onFinish ====================== */
function useAnimatedNumber(
  value: number,
  opts?: { duration?: number; easing?: (t: number) => number; onFinish?: () => void }
) {
  // easing padrão (cúbica out). Definido fora do effect para não mudar a cada render.
  const defaultEasing = (t: number) => 1 - Math.pow(1 - t, 3);

  // primitives estáveis
  const duration = opts?.duration ?? 800;

  // guardamos a função de easing em uma ref para não disparar re-render/efeito
  const easingRef = React.useRef<(t: number) => number>(opts?.easing ?? defaultEasing);
  React.useEffect(() => {
    if (opts?.easing) easingRef.current = opts.easing;
  }, [opts?.easing]);

  const [display, setDisplay] = useState(value);
  const prevRef = React.useRef(value);

  React.useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easingRef.current(t);
      // arredonda para 2 casas para evitar tremor visual ao formatar
      const next = Math.round((from + (to - from) * k) * 100) / 100;
      setDisplay(next);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
        setDisplay(to);
        opts?.onFinish?.(); // avisa o término (para o "pulso")
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

/* ====================== Utilidades de data ====================== */
function parseBrDate(d?: string): number {
  // tenta dd/mm/aaaa; se falhar, cai para Date normal
  if (!d) return Date.now();
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, dd, mm, yyyy] = m;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
  }
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : Date.now();
}

function buildSparkPathFromTransactions(
  transactions: any[],
  width = 600,
  height = 200
): string {
  const sorted = [...transactions].sort((a, b) => {
    const ta = parseBrDate(a.date);
    const tb = parseBrDate(b.date);
    return ta - tb || String(a.id).localeCompare(String(b.id));
  });

  let running = 0;
  const acc: number[] = [];
  for (const t of sorted) {
    if (t.type === 'income') {
      const st = t.status ?? 'pending';
      if (st === 'paid') running += Number(t.amount) || 0;
    } else if (t.type === 'expense') {
      running -= Number(t.amount) || 0;
    }
    acc.push(running);
  }

  if (acc.length === 0) return `M0,110 C150,110 300,110 600,110`;

  const last = acc.slice(-16);
  const min = Math.min(...last);
  const max = Math.max(...last);
  const range = Math.max(1, max - min);

  // base central do gráfico
  const midY = height * 0.52;

  // amplitude mais agressiva (mas com teto/assoalho controlados)
  // usa log para não explodir com ranges enormes e dar vida a ranges pequenos
  const ampLog = Math.log10(range + 10);
  const ampBase = Math.min(96, Math.max(36, ampLog * 28));

  const pts: Pt[] = last.map((v, i) => {
    const x = (i / (last.length - 1)) * width;
    const y = midY - ((v - (min + range / 2)) / range) * ampBase * 1.9; // ganho extra
    return { x, y };
  });

  return catmullToBezier(pts);
}

/* ======================================================================== */

const Finance: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false); // <- ativa o pulso ao final da animação

  const {
    transactions,
    loading,
    addTransaction,
    deleteTransaction,
    editTransaction,
    updateTxStatus,
  } = useTransactions();

  // -------- helpers de extração/fallback --------
  const extractProfessional = (t: any): string | undefined => {
    if (t?.professionalName) return t.professionalName as string;
    if (t?.professional) return t.professional as string;
    if (typeof t?.description === 'string') {
      const parts = t.description.split('\n');
      if (parts[1]) return parts[1].trim();
    }
    return undefined;
  };

  const extractPatientFromDesc = (desc?: string): string | undefined => {
    if (!desc) return undefined;
    const m = desc.match(/Atendimento\s*-\s*(.+?)\s*\((.+?)\)/i);
    return m?.[1]?.trim();
  };

  const extractService = (t: any): string | undefined => {
    if (t?.service) return String(t.service);
    if (typeof t?.description === 'string') {
      const m = t.description.match(/\(([^)]+)\)\s*$/);
      if (m?.[1]) return m[1].trim();
    }
    if (t?.category) return String(t.category);
    return undefined;
  };

  const extractNotes = (t: any): string | undefined =>
    t?.notes ?? t?.observation ?? t?.observations ?? t?.appointmentNotes ?? undefined;

  const minutesBetween = (a: Date, b: Date) =>
    Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));

  const extractDurationMin = (t: any): number | undefined => {
    if (typeof t?.durationMin === 'number') return t.durationMin;
    if (typeof t?.actualDuration === 'number') return t.actualDuration;
    const startISO = t?.startedAt ?? t?.started_at ?? null;
    const endISO = t?.finishedAt ?? t?.finished_at ?? null;
    if (startISO && endISO) {
      const start = new Date(startISO);
      const end = new Date(endISO);
      const m = minutesBetween(start, end);
      if (Number.isFinite(m)) return m;
    }
    return undefined;
  };

  // Totais (receitas pagas)
  const totalRevenue = transactions
    .filter((t: any) => t.type === 'income' && ((t.status ?? 'pending') === 'paid'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalRevenue - totalExpenses;
  const isNegative = balance < 0;
  const isPositive = balance > 0;

  // número animado + pulso ao terminar
  const animatedBalance = useAnimatedNumber(showBalance ? balance : 0, {
    duration: 900,
    onFinish: () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 180);
    },
  });

  // Sparkline reage a alterações das transações/saldo
  const sparkPathD = useMemo(
    () => buildSparkPathFromTransactions(transactions as any[], 600, 200),
    [transactions]
  );

  const handleEdit = (id: string) => {
    const t = transactions.find((x) => x.id === id) || null;
    setEditing(t as Transaction | null);
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm('Deseja realmente excluir esta transação? Essa ação não pode ser desfeita.');
    if (!ok) return;
    await deleteTransaction(id);
  };

  const handleSaveEdit = async (updates: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
    date: string;
  }) => {
    if (!editing) return;
    await editTransaction(editing.id, updates);
    setEditing(null);
  };

  const handleAdd = async (newTransaction: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
  }) => {
    await addTransaction(newTransaction);
    setIsModalOpen(false);
  };

  const toggleOpen = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando transações...</div>
      </div>
    );
  }

  const neutralMode = !showBalance || balance === 0;

  return (
    <div className="pb-24 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-black to-indigo-600 px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Card do Saldo */}
        <div className="relative overflow-hidden rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.18)]">
          {/* Sparkline único */}
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full"
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d={sparkPathD}
              fill="none"
              stroke={
                neutralMode
                  ? 'rgba(255, 255, 255, 0.5)'
                  : isNegative
                  ? '#ef4444'
                  : '#22c55e'
              }
              strokeWidth="2.8"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="-120 0"
                to="0 0"
                dur="4.5s"
                repeatCount="indefinite"
              />
            </path>
          </svg>

          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-xl">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/90 font-medium text-sm sm:text-base">Saldo Total</span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 bg-white/15 rounded-xl hover:bg-white/25 transition-colors"
              title={showBalance ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showBalance ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
            </button>
          </div>

          {/* Pílula do valor */}
          <div className="text-center relative z-10">
            <div
              className={[
                'inline-flex items-center justify-center px-5 py-2.5 rounded-2xl backdrop-blur',
                'transition-transform duration-250 will-change-transform', // pulso suave
                pulse ? 'scale-110' : 'scale-100',
                neutralMode
                  ? 'bg-transparent shadow-none ring-0'
                  : 'bg-white/92 shadow-[0_8px_20px_rgba(0,0,0,.18)] ring-0',
              ].join(' ')}
            >
              <span
                className={[
                  'text-2xl sm:text-4xl font-bold tabular-nums tracking-tight',
                  neutralMode
                    ? 'text-white'
                    : isNegative
                    ? 'text-red-600'
                    : isPositive
                    ? 'text-green-600'
                    : 'text-slate-900',
                ].join(' ')}
              >
                {showBalance
                  ? `R$ ${animatedBalance.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : '••••••'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="px-6 mt-10 md:mt-20 lg:mt-24 mb-6 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all">
            <div className="flex items-start gap-2 mb-3">
              <div className="p-2 bg-green-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Receitas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
              {showBalance
                ? `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </p>
            <div className="mt-2 w-full bg-green-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: totalRevenue > 0 ? '100%' : '0%' }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all">
            <div className="flex items-start gap-2 mb-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Despesas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-600 break-all">
              {showBalance
                ? `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </p>
            <div className="mt-2 w-full bg-red-100 rounded-full h-1.5">
              <div
                className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: totalExpenses > 0 ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transações */}
      <div className="px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-xl font-bold text-gray-900">Transações Recentes</h2>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <span className="text-xs sm:text-sm text-gray-500">{transactions.length} transações</span>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100/50 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma transação ainda</h3>
            <p className="text-gray-500 mb-4">Adicione sua primeira transação para começar</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Adicionar Transação
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-32">
            {transactions.map((t: any) => {
              const prof = extractProfessional(t);
              const patient = t.patientName ?? extractPatientFromDesc(t.description);
              const service = extractService(t);
              const status = t.type === 'income' ? (t.status ?? 'pending') : undefined;
              const duration = extractDurationMin(t);
              const notes = extractNotes(t);

              return (
                <div key={t.id} className="group">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOpen(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleOpen(t.id);
                      }
                    }}
                  >
                    <TransactionCard
                      transaction={{ ...t, professionalName: prof, patientName: patient, service, status }}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onUpdateStatus={(id, next) => updateTxStatus(id, next)}
                      isOpen={openId === t.id}
                    />
                  </div>

                  {openId === t.id && (
                    <div className="mx-1 mt-[-6px] rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Categoria</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{service ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Data</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{t.date}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Profissional</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{prof ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Paciente</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{patient ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Duração</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">
                            {typeof duration === 'number' ? `${duration} min` : '—'}
                          </div>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-4 h-4 rounded bg-gray-200" />
                            <span className="text-gray-500">Observações</span>
                          </div>
                          <div className="pl-6 text-gray-700">{notes ?? '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditTransactionModal
        isOpen={!!editing}
        transaction={editing}
        onClose={() => setEditing(null)}
        onSave={handleSaveEdit}
      />

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default Finance;
