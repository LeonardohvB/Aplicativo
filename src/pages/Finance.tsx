// src/pages/Finance.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Wallet,
  CreditCard,
  Filter,
  Edit2,
  Trash2,
  Calendar,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
} from 'lucide-react';

import TransactionCard from '../components/Finance/TransactionCard';
import AddTransactionModal from '../components/Finance/AddTransactionModal';
import EditTransactionModal from '../components/Finance/EditTransactionModal';
import TransactionDetails from '../components/Finance/TransactionDetails';
import { useTransactions } from '../hooks/useTransactions';
import type { Transaction } from '../types';
import { getMoneyVisible, setMoneyVisible } from '../utils/prefs';
import { useConfirm } from '../providers/ConfirmProvider';
import { ToastContainer, useToast } from '../components/ui/Toast';

/* ====================== Tipos ====================== */
type TxStatus = 'paid' | 'pending' | (string & {});
type Pt = { x: number; y: number };

/* ====================== Utils spark ====================== */
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

/* ====================== Número animado ====================== */
function useAnimatedNumber(
  value: number,
  opts?: { duration?: number; easing?: (t: number) => number; onFinish?: () => void }
) {
  const defaultEasing = (t: number) => 1 - Math.pow(1 - t, 3);
  const duration = opts?.duration ?? 800;
  const easingRef = React.useRef<(t: number) => number>(opts?.easing ?? defaultEasing);
  useEffect(() => {
    if (opts?.easing) easingRef.current = opts.easing;
  }, [opts?.easing]);

  const [display, setDisplay] = useState(value);
  const prevRef = React.useRef(value);

  useEffect(() => {
    const from = prevRef.current, to = value;
    if (from === to) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easingRef.current(t);
      const next = Math.round((from + (to - from) * k) * 100) / 100;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        prevRef.current = to;
        setDisplay(to);
        opts?.onFinish?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

/* ====================== Datas ====================== */
function parseBrDate(d?: string): number {
  if (!d) return Date.now();
  const m = d?.match?.(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const t = Date.parse(d ?? '');
  return Number.isFinite(t) ? t : Date.now();
}
function isoLocalDate(d = new Date()): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function formatBr(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function dayKey(dateStr?: string): string {
  const t = parseBrDate(dateStr);
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ====================== Swipe Row (mobile/desktop) ====================== */
type SwipeRowProps = {
  rowId: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
};

function SwipeRow({ rowId, isOpen, onOpen, onClose, onEdit, onDelete, children }: SwipeRowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number>(0);
  const dragging = useRef<boolean>(false);
  const [tx, setTx] = useState<number>(0);

  const ACTIONS_WIDTH = 144;
  const OPEN_TX = -ACTIONS_WIDTH;

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [onClose]);

  useEffect(() => { setTx(isOpen ? OPEN_TX : 0); }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    let next = (isOpen ? OPEN_TX : 0) + dx;
    next = Math.min(0, Math.max(next, -ACTIONS_WIDTH));
    setTx(next);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (tx < -40) { setTx(OPEN_TX); onOpen(rowId); }
    else { setTx(0); onClose(); }
  };

  const onTouchStart = (e: React.TouchEvent) => { dragging.current = true; startX.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    let next = (isOpen ? OPEN_TX : 0) + dx;
    next = Math.min(0, Math.max(next, -ACTIONS_WIDTH));
    setTx(next);
  };
  const onTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (tx < -40) { setTx(OPEN_TX); onOpen(rowId); }
    else { setTx(0); onClose(); }
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {/* ações */}
      <div className="absolute right-0 top-0 z-0 flex h-full w-36 items-center justify-center pr-3 pl-3 pointer-events-none">
        <div className="flex flex-col items-center justify-center gap-4 p-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow transition hover:bg-indigo-700"
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600 text-white shadow transition hover:bg-rose-700"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* card deslizante */}
      <div
        className="bg-transparent"
        style={{ transform: `translateX(${tx}px)`, transition: dragging.current ? 'none' : 'transform 180ms ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

/* ======================================================================== */

const Finance: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // preferências
  const [showBalance, setShowBalance] = useState<boolean>(() => getMoneyVisible());
  const toggleShowBalance = () => {
    setShowBalance((v) => {
      const nv = !v;
      setMoneyVisible(nv);
      return nv;
    });
  };

  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  const { transactions, loading, addTransaction, deleteTransaction, editTransaction, updateTxStatus } =
    useTransactions();

  const { success } = useToast();

  /* Filtros */
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusTab, setStatusTab] = useState<'all' | 'paid' | 'pending'>('all'); // tabs
  const [customEnabled, setCustomEnabled] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(isoLocalDate());
  const [dateTo, setDateTo] = useState<string>(isoLocalDate());
  const [searchQuery, setSearchQuery] = useState('');

  const askConfirm = useConfirm();

  /* “Não pagos” = receitas pendentes (toggle único “Pendentes”) */
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const unpaidCount = useMemo(
    () => transactions.filter((t) => t.type === 'income' && (t.status ?? 'pending') !== 'paid').length,
    [transactions]
  );
  const toggleUnpaidOnly = () => {
    setUnpaidOnly((v) => {
      const nv = !v;
      if (nv && txFilter === 'expense') setTxFilter('income');
      return nv;
    });
  };

  /* Filtro combinado */
  const visibleTxs = useMemo(() => {
    let base = [...transactions];

    // tipo
    if (txFilter !== 'all') base = base.filter((t) => t.type === txFilter);

    // status tabs
    if (statusTab !== 'all') {
      base = base.filter((t) =>
        t.type === 'income' ? ((t.status ?? 'pending') === statusTab) : true
      );
    }

    // não pagos toggle
    if (unpaidOnly) {
      base = base.filter((t) => t.type === 'income' && (t.status ?? 'pending') !== 'paid');
    }

    // datas
    if (customEnabled) {
      const min = new Date(`${dateFrom}T00:00:00`).getTime();
      const max = new Date(`${dateTo}T23:59:59`).getTime();
      base = base.filter((t) => {
        const tt = parseBrDate(t.date);
        return tt >= min && tt <= max;
      });
    }

    // busca
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      base = base.filter((t) => {
        const hay = [
          t.description, t.category, (t as any).professionalName, (t as any).patientName,
          (t as any).service, (t as any).notes, (t as any).paymentMethod
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return base;
  }, [transactions, txFilter, customEnabled, dateFrom, dateTo, unpaidOnly, searchQuery, statusTab]);

  /* Helpers extração */
  const extractProfessional = (t: any): string | undefined => {
    if (t?.professionalName) return t.professionalName;
    if (t?.professional) return t.professional;
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

  // Totais
  const totalRevenuePaid = transactions
    .filter((t: any) => t.type === 'income' && (t.status ?? 'pending') === 'paid')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const balance = totalRevenuePaid - totalExpenses;
  const paidIncomes = transactions.filter((t) => t.type === 'income' && (t.status ?? 'pending') === 'paid');
  const avgTicket = paidIncomes.length ? totalRevenuePaid / paidIncomes.length : 0;

  const MASK = '•'.repeat(6);
  const isNegative = balance < 0, isPositive = balance > 0;

  // animações
  const animatedBalance = useAnimatedNumber(balance, {
    duration: 900,
    onFinish: () => { setPulse(true); setTimeout(() => setPulse(false), 180); },
  });
  const [revPulse, setRevPulse] = useState(false);
  const [expPulse, setExpPulse] = useState(false);
  const animatedRevenue = useAnimatedNumber(totalRevenuePaid, {
    duration: 900,
    onFinish: () => { setRevPulse(true); setTimeout(() => setRevPulse(false), 180); },
  });
  const animatedExpenses = useAnimatedNumber(totalExpenses, {
    duration: 900,
    onFinish: () => { setExpPulse(true); setTimeout(() => setExpPulse(false), 180); },
  });

  const sparkPathD = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => parseBrDate(a.date) - parseBrDate(b.date) || String(a.id).localeCompare(String(b.id))
    );
    let running = 0;
    const acc: number[] = [];
    for (const t of sorted) {
      if (t.type === 'income') {
        if ((t.status ?? 'pending') === 'paid') running += Number(t.amount) || 0;
      } else if (t.type === 'expense') running -= Number(t.amount) || 0;
      acc.push(running);
    }
    if (acc.length === 0) return `M0,110 C150,110 300,110 600,110`;
    const last = acc.slice(-16),
      min = Math.min(...last),
      max = Math.max(...last),
      range = Math.max(1, max - min);
    const width = 600, height = 200;
    const midY = height * 0.52,
      ampLog = Math.log10(range + 10),
      ampBase = Math.min(96, Math.max(36, ampLog * 28));
    const pts: Pt[] = last.map((v, i) => ({
      x: (i / (last.length - 1)) * width,
      y: midY - ((v - (min + range / 2)) / range) * ampBase * 1.9,
    }));
    return catmullToBezier(pts);
  }, [transactions]);

  /* Agrupamento por dia (para lista de cards) */
  type Group = { key: string; label: string; items: any[] };
  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const t of visibleTxs) {
      const k = dayKey(t.date);
      const g = map.get(k);
      if (g) g.items.push(t);
      else map.set(k, { key: k, label: formatBr(new Date(k)), items: [t] });
    }
    const out = Array.from(map.values()).sort((a, b) => +new Date(b.key) - +new Date(a.key));
    for (const g of out) g.items.sort((a, b) => parseBrDate(b.date) - parseBrDate(a.date));
    return out;
  }, [visibleTxs]);

  const handleEdit = (id: string) =>
    setEditing((transactions.find((x) => x.id === id) as Transaction) || null);

  // alterna Pago/Pendente em receitas
  const toggleIncomeStatus = (id: string, next: 'paid' | 'pending') => {
    updateTxStatus(id, next);
  };

  const handleDelete = async (id: string) => {
    const ok = await askConfirm({
      title: 'Excluir transação?',
      description: 'Deseja realmente excluir esta transação? Essa ação não pode ser desfeita.',
      okText: 'Excluir',
      cancelText: 'Cancelar',
      icon: <Trash2 className="w-6 h-6" />,
    } as any);
    if (!ok) return;
    await deleteTransaction(id);
    success('Transação excluída.');
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
    success('Transação atualizada.');
    setEditing(null);
  };

  const handleAdd = async (newTransaction: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
  }) => {
    await addTransaction(newTransaction);
    success('Transação adicionada com sucesso.');
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Carregando transações...
      </div>
    );
  }

  const neutralMode = !showBalance || balance === 0;

  /* ====================== LAYOUT ====================== */
  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-slate-50 via-slate-50 to-white text-slate-800">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6 lg:px-8">

      {/* Header */}
<div className="pt-6 mb-6 md:mb-8">
  <div className="flex items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold">Financeiro</h1>
      <p className="text-slate-400 text-sm md:text-base mt-1">
        Gerencie suas finanças e transações
      </p>
    </div>

    {/* Desktop: somente a busca (branco / texto escuro) */}
    <div className="hidden md:flex items-center gap-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar transações..."
          className="h-10 w-[22rem] pl-9 pr-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-500
                     ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
        />
      </div>
    </div>
  </div>
</div>


        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">

          {/* Coluna principal (Saldo grande) */}
          <div className="col-span-12 xl:col-span-8">
            <div className="relative overflow-hidden rounded-2xl p-6 ring-1 ring-white/10 bg-gradient-to-br from-slate-900 to-indigo-950 shadow-xl">
              {/* sparkline */}
              <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d={sparkPathD}
                  fill="none"
                  stroke={neutralMode ? 'rgba(148,163,184,.35)' : isNegative ? '#ef4444' : '#22c55e'}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                >
                  <animateTransform attributeName="transform" type="translate" from="-120 0" to="0 0" dur="5s" repeatCount="indefinite" />
                </path>
              </svg>

              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/10">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-white/90 font-medium">Saldo Total Disponível</div>
                </div>

                <button
                  onClick={toggleShowBalance}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition"
                  title={showBalance ? 'Ocultar valores' : 'Mostrar valores'}
                >
                  {showBalance ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
                </button>
              </div>

              <div className="relative z-10 mt-6">
  <div
    className={[
      'inline-flex items-center justify-center px-5 py-3 rounded-2xl backdrop-blur transition-transform duration-250',
      pulse ? 'scale-110' : 'scale-100',
      // mesmo visual para visível/oculto
      'bg-white/5 ring-1 ring-white/10 text-white'
    ].join(' ')}
  >
    <span className="text-3xl md:text-4xl font-bold tabular-nums tracking-tight">
      {showBalance
        ? `R$ ${animatedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `R$ ${'•'.repeat(6)}`}
    </span>
  </div>


                {/* mini-cards Receitas / Despesas */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`rounded-xl p-4 ring-1 transition ${txFilter === 'income' ? 'ring-emerald-400/40 bg-emerald-500/5' : 'ring-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15"><TrendingUp className="w-4 h-4 text-emerald-400" /></span>
                        <div className="text-sm text-slate-300">Receitas (este mês)</div>
                      </div>
                      <button onClick={() => setTxFilter((f) => (f === 'income' ? 'all' : 'income'))} className="text-xs text-emerald-400 hover:underline">
                        {txFilter === 'income' ? 'Mostrar todas' : 'Filtrar'}
                      </button>
                    </div>
                    <div className={`mt-2 text-2xl font-bold text-emerald-400 ${revPulse ? 'scale-105' : ''}`}>
    {showBalance ? `R$ ${animatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${MASK}`}
  </div>
</div>

                  <div className={`rounded-xl p-4 ring-1 transition ${txFilter === 'expense' ? 'ring-rose-400/40 bg-rose-500/5' : 'ring-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15"><TrendingDown className="w-4 h-4 text-rose-400" /></span>
                        <div className="text-sm text-slate-300">Despesas (este mês)</div>
                      </div>
                      <button onClick={() => setTxFilter((f) => (f === 'expense' ? 'all' : 'expense'))} className="text-xs text-rose-400 hover:underline">
                        {txFilter === 'expense' ? 'Mostrar todas' : 'Filtrar'}
                      </button>
                    </div>
                     <div className={`mt-2 text-2xl font-bold text-rose-400 ${expPulse ? 'scale-105' : ''}`}>
    {showBalance ? `R$ ${animatedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${MASK}`}
  </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-rose-300 text-xs">
                      <ArrowDownRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna direita (cards métricas) */}
          <div className="col-span-12 xl:col-span-4 grid grid-cols-1 gap-4 md:gap-6">
            <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-gradient-to-br from-slate-900 to-indigo-950 shadow">
              <div className="text-sm text-slate-300">Transações</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">{visibleTxs.length}</div>
              <div className="mt-2 inline-flex items-center gap-1 text-emerald-400 text-xs">
                <ArrowUpRight className="w-3 h-3" /> +{Math.max(0, visibleTxs.length - 1)}%
              </div>
            </div>

            <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-gradient-to-br from-slate-900 to-indigo-950 shadow">
              <div className="text-sm text-slate-300">Ticket Médio</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">
                R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-emerald-400 text-xs">
                <ArrowUpRight className="w-3 h-3" /> +8%
              </div>
            </div>

            <div className="rounded-2xl p-5 ring-1 ring-white/10 bg-gradient-to-br from-slate-900 to-indigo-950 shadow">
              <div className="text-sm text-slate-300">Recebimentos</div>
              <div className="mt-2 text-2xl font-bold text-slate-100">
                R$ {totalRevenuePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-emerald-400 text-xs">
                <ArrowUpRight className="w-3 h-3" /> +100%
              </div>
            </div>
          </div>
        </div>

        {/* Barra de ações (mobile) */}
        <div className="md:hidden mt-6 flex items-center gap-2">
          <div className="relative flex-1 rounded-xl ring-1 ring-slate-200 bg-white shadow">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar transações..."
              className="pl-9 pr-3 h-10 w-full bg-transparent text-slate-900 placeholder:text-slate-500
               focus:outline-none focus:ring-2 focus:ring-indigo-500/60 rounded-xl"
            />
          </div>
          <button
            onClick={toggleUnpaidOnly}
            className={`h-10 inline-flex items-center gap-2 px-3 rounded-xl ring-1 transition shadow
              ${unpaidOnly ? 'bg-amber-500 text-white ring-amber-500' : 'bg-white text-slate-700 ring-slate-200'}`}
            title="Mostrar apenas receitas pendentes"
          >
            <Clock3 className="w-4 h-4" />
            <span>Pendentes</span>
            <span className={`ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-xs ${unpaidOnly ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>{unpaidCount}</span>
          </button>
          <button
            onClick={() => setCustomEnabled((v) => !v)}
            className={`h-10 inline-flex items-center gap-2 px-3 rounded-xl ring-1 transition shadow
              ${customEnabled ? 'bg-indigo-600 text-white ring-indigo-600'
              : 'bg-white text-slate-700 ring-slate-200'}`}
            title="Filtros"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros extras (datas) — usa setDateFrom / setDateTo */}
        {customEnabled && (
          <div className="mt-4 rounded-2xl ring-1 ring-white/10 bg-slate-900/70 p-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Data inicial</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Data final</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg bg-slate-950/60 ring-1 ring-white/10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100"
              />
            </div>
          </div>
        )}

        {/* Tabela / Lista de transações */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold">Transações Recentes</h2>
              <p className="text-slate-400 text-sm">Histórico completo de movimentações</p>
            </div>

            {/* Tabs status (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              {(['all','paid','pending'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setStatusTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-sm ring-1 transition
                    ${statusTab === k ? 'bg-slate-800 text-white ring-white/20' : 'bg-slate-900/60 text-slate-300 ring-white/10 hover:bg-slate-900'}`}
                >
                  {k === 'all' ? 'Todos' : k === 'paid' ? 'Pagos' : 'Pendentes'}
                </button>
              ))}
              <div className="ml-2 text-slate-400 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                {visibleTxs.length} transações
              </div>
            </div>
          </div>

          {/* “Nova Transação” abaixo das tabs (desktop e mobile) */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow"
              title="Nova Transação"
            >
              <Plus className="w-4 h-4" />
              Nova Transação
            </button>
          </div>

          {/* LISTA EM CARDS (desktop e mobile iguais) */}
          <div className="space-y-8 pb-32">
            {groups.map((g) => (
              <div key={g.key}>
                {/* Cabeçalho da data */}
                <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium text-slate-600">{g.label}</span>
                </div>

                <div className="space-y-3">
                  {g.items.map((t: any) => {
                    const prof = extractProfessional(t);
                    const patient = t.patientName ?? extractPatientFromDesc(t.description);
                    const service = extractService(t);
                    const status: TxStatus | undefined =
                      t.type === 'income' ? ((t.status ?? 'pending') as TxStatus) : undefined;
                    const notes = extractNotes(t);

                    const isDetailsOpen = detailsOpenId === t.id;
                    const isSwipeOpen = swipeOpenId === t.id;

                    return (
                      <SwipeRow
                        key={t.id}
                        rowId={t.id}
                        isOpen={isSwipeOpen}
                        onOpen={(id) => setSwipeOpenId(id)}
                        onClose={() => setSwipeOpenId(null)}
                        onEdit={() => handleEdit(t.id)}
                        onDelete={() => handleDelete(t.id)}
                      >
                        {/* CARD único */}
                        <div className={`rounded-2xl ring-1 ring-gray-200 bg-white shadow-md transition-all ${isDetailsOpen ? 'ring-2 ring-indigo-200' : ''}`}>
                          {/* Header */}
                          <div
                            role="button"
                            tabIndex={0}
                            className="p-5"
                            onClick={() => setDetailsOpenId((cur) => (cur === t.id ? null : t.id))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setDetailsOpenId((cur) => (cur === t.id ? null : t.id));
                              }
                            }}
                          >
                            <TransactionCard
                              wrap={false}
                              transaction={{ ...t, professionalName: prof, patientName: patient, service, status }}
                              onUpdateStatus={toggleIncomeStatus}
                              isOpen={isDetailsOpen}
                            />
                          </div>

                          {/* Expand */}
                          <div
                            className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isDetailsOpen ? 'max-h-[520px] opacity-100' : 'max-h-0 opacity-0'}`}
                          >
                            <div className="mx-5 mt-2 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <div className="px-5 pb-5">
                              <TransactionDetails
                                tx={{
                                  ...t,
                                  professionalName: prof,
                                  patientName: patient,
                                  service,
                                  notes,
                                  status,
                                  paymentMethod: (t as any).paymentMethod ?? (t as any).method ?? null,
                                  paidAt: (t as any).paidAt ?? (t as any).paid_at ?? null,
                                }}
                                onUpdateStatus={(id, next) => updateTxStatus(id, next)}
                              />
                            </div>
                          </div>
                        </div>
                      </SwipeRow>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modais */}
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

        {/* Toast */}
        <ToastContainer />
      </div>
    </div>
  );
};

export default Finance;
