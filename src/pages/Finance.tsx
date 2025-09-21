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
  Calendar,
  Tag,
  User,
  Clock,
  Filter,   // ← funil do lucide
  Edit2,    // ← adicionado para o botão de editar (painel lateral)
  Trash2,   // ← adicionado para o botão de excluir (painel lateral)
} from 'lucide-react';
import TransactionCard from '../components/Finance/TransactionCard';
import AddTransactionModal from '../components/Finance/AddTransactionModal';
import EditTransactionModal from '../components/Finance/EditTransactionModal';
import { useTransactions } from '../hooks/useTransactions';
import { Transaction } from '../types';

/* ====================== SPARKLINE ====================== */
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

/* ====================== Número animado ====================== */
function useAnimatedNumber(
  value: number,
  opts?: { duration?: number; easing?: (t: number) => number; onFinish?: () => void }
) {
  const defaultEasing = (t: number) => 1 - Math.pow(1 - t, 3);
  const duration = opts?.duration ?? 800;
  const easingRef = React.useRef<(t: number) => number>(opts?.easing ?? defaultEasing);
  useEffect(() => { if (opts?.easing) easingRef.current = opts.easing; }, [opts?.easing]);

  const [display, setDisplay] = useState(value);
  const prevRef = React.useRef(value);

  useEffect(() => {
    const from = prevRef.current, to = value;
    if (from === to) return;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = easingRef.current(t);
      const next = Math.round((from + (to - from) * k) * 100) / 100;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { prevRef.current = to; setDisplay(to); opts?.onFinish?.(); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

/* ====================== Datas ====================== */
function parseBrDate(d?: string): number {
  if (!d) return Date.now();
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  const t = Date.parse(d); return Number.isFinite(t) ? t : Date.now();
}
function isoLocalDate(d = new Date()): string {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function buildSparkPathFromTransactions(transactions: any[], width = 600, height = 200): string {
  const sorted = [...transactions].sort((a, b) => parseBrDate(a.date) - parseBrDate(b.date) || String(a.id).localeCompare(String(b.id)));
  let running = 0; const acc: number[] = [];
  for (const t of sorted) {
    if (t.type === 'income') { if ((t.status ?? 'pending') === 'paid') running += Number(t.amount) || 0; }
    else if (t.type === 'expense') running -= Number(t.amount) || 0;
    acc.push(running);
  }
  if (acc.length === 0) return `M0,110 C150,110 300,110 600,110`;
  const last = acc.slice(-16), min = Math.min(...last), max = Math.max(...last), range = Math.max(1, max - min);
  const midY = height * 0.52, ampLog = Math.log10(range + 10), ampBase = Math.min(96, Math.max(36, ampLog * 28));
  const pts: Pt[] = last.map((v, i) => ({ x: (i / (last.length - 1)) * width, y: midY - ((v - (min + range / 2)) / range) * ampBase * 1.9 }));
  return catmullToBezier(pts);
}

/* ====================== Swipe Row (sem libs) ====================== */
// Painel de ações à direita (vertical) aparece ao arrastar para a esquerda.
// Fecha ao arrastar para a direita ou clicar fora.
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
  const currentX = useRef<number>(0);
  const dragging = useRef<boolean>(false);
  const [tx, setTx] = useState<number>(0); // translateX do conteúdo

  const ACTIONS_WIDTH = 100; // largura do painel de ações
  const OPEN_TX = -ACTIONS_WIDTH;

  // Fecha ao clicar fora
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [onClose]);

  // Sincroniza estado aberto/fechado com translate
  useEffect(() => { setTx(isOpen ? OPEN_TX : 0); }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    currentX.current = isOpen ? startX.current + OPEN_TX : startX.current;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    let next = (isOpen ? OPEN_TX : 0) + dx;
    // limitações: não arrastar para a esquerda além do painel, nem para a direita além de 0
    next = Math.min(0, Math.max(next, -ACTIONS_WIDTH));
    setTx(next);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    // snap: se passou de -40px, abre; caso contrário, fecha
    if (tx < -40) {
      setTx(OPEN_TX);
      onOpen(rowId);
    } else {
      setTx(0);
      onClose();
    }
  };

  // Suporte a toque (touch) – encaminha para pointer
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startX.current = e.touches[0].clientX;
    currentX.current = isOpen ? startX.current + OPEN_TX : startX.current;
  };
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
    if (tx < -40) {
      setTx(OPEN_TX);
      onOpen(rowId);
    } else {
      setTx(0);
      onClose();
    }
  };
  

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Painel de ações (lado direito) */}
      <div className="absolute right-0 top-0 h-full w-24 pr-2 pl-2 flex items-center justify-center">
        <div className="h-[0px] w-[0px] rounded-2xl bg-white shadow-lg border border-gray-100 flex flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
            aria-label="Editar"
            title="Editar"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-6 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow transition"
            aria-label="Excluir"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conteúdo deslizável */}
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
  const [showBalance, setShowBalance] = useState(true);

  // Estado para o painel de detalhes (o seu "isOpen" dos cards)
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  // Estado para o swipe (ações Editar/Excluir)
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const [pulse, setPulse] = useState(false);

  const { transactions, loading, addTransaction, deleteTransaction, editTransaction, updateTxStatus } = useTransactions();

  /* Filtros */
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [customEnabled, setCustomEnabled] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>(isoLocalDate());
  const [dateTo, setDateTo] = useState<string>(isoLocalDate());

  const visibleTxs = useMemo(() => {
    let base = [...transactions];
    if (txFilter !== 'all') base = base.filter((t) => t.type === txFilter);
    if (customEnabled) {
      const min = new Date(`${dateFrom}T00:00:00`).getTime();
      const max = new Date(`${dateTo}T23:59:59`).getTime();
      base = base.filter((t) => { const tt = parseBrDate(t.date); return tt >= min && tt <= max; });
    }
    return base;
  }, [transactions, txFilter, customEnabled, dateFrom, dateTo]);

  /* Helpers de extração para o card */
  const extractProfessional = (t: any): string | undefined => {
    if (t?.professionalName) return t.professionalName;
    if (t?.professional) return t.professional;
    if (typeof t?.description === 'string') { const parts = t.description.split('\n'); if (parts[1]) return parts[1].trim(); }
    return undefined;
  };
  const extractPatientFromDesc = (desc?: string): string | undefined => {
    if (!desc) return undefined;
    const m = desc.match(/Atendimento\s*-\s*(.+?)\s*\((.+?)\)/i);
    return m?.[1]?.trim();
  };
  const extractService = (t: any): string | undefined => {
    if (t?.service) return String(t.service);
    if (typeof t?.description === 'string') { const m = t.description.match(/\(([^)]+)\)\s*$/); if (m?.[1]) return m[1].trim(); }
    if (t?.category) return String(t.category);
    return undefined;
  };
  const extractNotes = (t: any): string | undefined => t?.notes ?? t?.observation ?? t?.observations ?? t?.appointmentNotes ?? undefined;
  const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  const extractDurationMin = (t: any): number | undefined => {
    if (typeof t?.durationMin === 'number') return t.durationMin;
    if (typeof t?.actualDuration === 'number') return t.actualDuration;
    const startISO = t?.startedAt ?? t?.started_at ?? null;
    const endISO = t?.finishedAt ?? t?.finished_at ?? null;
    if (startISO && endISO) { const m = minutesBetween(new Date(startISO), new Date(endISO)); if (Number.isFinite(m)) return m; }
    return undefined;
  };

  // Totais (globais)
  const totalRevenue = transactions.filter((t: any) => t.type === 'income' && ((t.status ?? 'pending') === 'paid')).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalRevenue - totalExpenses;
  const moneyBR = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const masked = (n: number) => (showBalance ? moneyBR(n) : '••••••');
  const isNegative = balance < 0, isPositive = balance > 0;

  const animatedBalance = useAnimatedNumber(showBalance ? balance : 0, {
    duration: 900,
    onFinish: () => { setPulse(true); setTimeout(() => setPulse(false), 180); },
  });

  const sparkPathD = useMemo(() => buildSparkPathFromTransactions(transactions as any[], 600, 200), [transactions]);

  const handleEdit = (id: string) => setEditing((transactions.find((x) => x.id === id) as Transaction) || null);
  const handleDelete = async (id: string) => { if (window.confirm('Deseja realmente excluir esta transação? Essa ação não pode ser desfeita.')) await deleteTransaction(id); };
  const handleSaveEdit = async (updates: { type: 'income' | 'expense'; description: string; amount: number; category: string; date: string; }) => {
    if (!editing) return; await editTransaction(editing.id, updates); setEditing(null);
  };
  const handleAdd = async (newTransaction: { type: 'income' | 'expense'; description: string; amount: number; category: string; }) => {
    await addTransaction(newTransaction); setIsModalOpen(false);
  };

  if (loading) {
    return (<div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center"><div className="text-gray-600">Carregando transações...</div></div>);
  }

  const neutralMode = !showBalance || balance === 0;

  return (
    <div className="pb-24 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-black to-indigo-600 px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Financeiro</h1>
          <button onClick={() => setIsModalOpen(true)} className="p-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all shadow-lg hover:shadow-xl">
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Card do Saldo */}
        <div className="relative overflow-hidden rounded-2xl p-6 ring-1 ring-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.18)]">
          <svg className="pointer-events-none absolute inset-0 w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true">
            <path d={sparkPathD} fill="none" stroke={neutralMode ? 'rgba(255, 255, 255, 0.5)' : isNegative ? '#ef4444' : '#22c55e'} strokeWidth="2.8" strokeLinecap="round">
              <animateTransform attributeName="transform" type="translate" from="-120 0" to="0 0" dur="4.5s" repeatCount="indefinite" />
            </path>
          </svg>

          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/15 rounded-xl"><Wallet className="w-5 h-5 text-white" /></div>
              <span className="text-white/90 font-medium text-sm sm:text-base">Saldo Total</span>
            </div>
            <button onClick={() => setShowBalance(!showBalance)} className="p-2 bg-white/15 rounded-xl hover:bg-white/25 transition-colors" title={showBalance ? 'Ocultar valores' : 'Mostrar valores'}>
              {showBalance ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
            </button>
          </div>

          <div className="text-center relative z-10">
            <div className={['inline-flex items-center justify-center px-5 py-2.5 rounded-2xl backdrop-blur transition-transform duration-250 will-change-transform', pulse ? 'scale-110' : 'scale-100', neutralMode ? 'bg-transparent shadow-none ring-0' : 'bg-white/92 shadow-[0_8px_20px_rgba(0,0,0,.18)] ring-0'].join(' ')}>
              <span className={['text-2xl sm:text-4xl font-bold tabular-nums tracking-tight', neutralMode ? 'text-white' : isNegative ? 'text-red-600' : isPositive ? 'text-green-600' : 'text-slate-900'].join(' ')}>
                {showBalance ? `R$ ${animatedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo (cards viram filtros de tipo) */}
      <div className="px-6 mt-10 md:mt-20 lg:mt-24 mb-6 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTxFilter((f) => (f === 'income' ? 'all' : 'income'))}
            className={`text-left bg-white rounded-2xl p-5 shadow-lg border transition-all ${txFilter === 'income' ? 'border-green-400 ring-2 ring-green-200' : 'border-gray-100/50 hover:shadow-xl'}`}
            aria-pressed={txFilter === 'income'}
            title="Filtrar por receitas"
          >
            <div className="flex items-start gap-2 mb-3">
              <div className="p-2 bg-green-50 rounded-xl"><TrendingUp className="w-5 h-5 text-green-600" /></div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Receitas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
               {masked(totalRevenue)}
              </p>
            <div className="mt-2 w-full bg-green-100 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: totalRevenue > 0 ? '100%' : '0%' }} />
            </div>
          </button>

          <button
            onClick={() => setTxFilter((f) => (f === 'expense' ? 'all' : 'expense'))}
            className={`text-left bg-white rounded-2xl p-5 shadow-lg border transition-all ${txFilter === 'expense' ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-100/50 hover:shadow-xl'}`}
            aria-pressed={txFilter === 'expense'}
            title="Filtrar por despesas"
          >
            <div className="flex items-start gap-2 mb-3">
              <div className="p-2 bg-red-50 rounded-xl"><TrendingDown className="w-5 h-5 text-red-600" /></div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Despesas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-600 break-all">
               {masked(totalExpenses)}
               </p>
            <div className="mt-2 w-full bg-red-100 rounded-full h-1.5">
              <div className="bg-red-500 h-1.5 rounded-full transition-all duration-500" style={{ width: totalExpenses > 0 ? '100%' : '0%' }} />
            </div>
          </button>
        </div>
      </div>

      {/* Transações + filtro Personalizado */}
      <div className="px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-gray-900">Transações Recentes</h2>

          <div className="flex items-center gap-2">
            {/* Personalizado */}
            <button
              onClick={() => setCustomEnabled((v) => !v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${customEnabled ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}
              title="Filtrar por intervalo de datas"
            >
              <span className="inline-flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Personalizado
              </span>
            </button>

            {/* Limpar tipo (Todos) — aparece só quando receitas/despesas estiver ativo */}
            {txFilter !== 'all' && (
              <button
                onClick={() => setTxFilter('all')}
                className="px-3 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50"
                title="Mostrar todas as transações"
              >
                Todos
              </button>
            )}

            <div className="flex items-center space-x-2 text-gray-500">
              <CreditCard className="w-5 h-5" />
              <span className="text-xs sm:text-sm">{visibleTxs.length} transações</span>
            </div>
          </div>
        </div>

        {/* Intervalo de datas (só quando personalizado estiver ativo) */}
        {customEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data inicial</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data final</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {visibleTxs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100/50 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma transação</h3>
            <p className="text-gray-500 mb-4">Tente alterar o tipo ou o intervalo personalizado.</p>
            <button onClick={() => setIsModalOpen(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">
              Adicionar Transação
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-32">
            {visibleTxs.map((t: any) => {
              const prof = extractProfessional(t);
              const patient = t.patientName ?? extractPatientFromDesc(t.description);
              const service = extractService(t);
              const status = t.type === 'income' ? (t.status ?? 'pending') : undefined;
              const duration = extractDurationMin(t);
              const notes = extractNotes(t);

              const isDetailsOpen = detailsOpenId === t.id;
              const isSwipeOpen = swipeOpenId === t.id;

              return (
                <div key={t.id} className="group">
                  <SwipeRow
                    rowId={t.id}
                    isOpen={isSwipeOpen}
                    onOpen={(id) => setSwipeOpenId(id)}
                    onClose={() => setSwipeOpenId(null)}
                    onEdit={() => handleEdit(t.id)}
                    onDelete={() => handleDelete(t.id)}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailsOpenId((cur) => (cur === t.id ? null : t.id))}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailsOpenId((cur) => (cur === t.id ? null : t.id)); } }}
                    >
                      <TransactionCard
                        transaction={{ ...t, professionalName: prof, patientName: patient, service, status }}
                        // IMPORTANTE: não passamos onEdit/onDelete para NÃO exibir na frente do card
                        onUpdateStatus={(id, next) => updateTxStatus(id, next)}
                        isOpen={isDetailsOpen}
                      />
                    </div>
                  </SwipeRow>

                  {isDetailsOpen && (
                    <div className="mx-1 mt-[-6px] rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><Tag className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Categoria</span></div>
                          <div className="pl-6 text-gray-900 font-medium">{service ?? '—'}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Data</span></div>
                          <div className="pl-6 text-gray-900 font-medium">{t.date}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Profissional</span></div>
                          <div className="pl-6 text-gray-900 font-medium">{prof ?? '—'}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><User className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Paciente</span></div>
                          <div className="pl-6 text-gray-900 font-medium">{patient ?? '—'}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Duração</span></div>
                          <div className="pl-6 text-gray-900 font-medium">{typeof duration === 'number' ? `${duration} min` : '—'}</div>
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex items-center gap-2 text-sm"><span className="w-4 h-4 rounded bg-gray-200" /><span className="text-gray-500">Observações</span></div>
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

      <EditTransactionModal isOpen={!!editing} transaction={editing} onClose={() => setEditing(null)} onSave={handleSaveEdit} />
      <AddTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAdd} />
    </div>
  );
};

export default Finance;
