// src/pages/Dashboard.tsx
import React from 'react';
import { Users, DollarSign, Calendar, Eye, EyeOff } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '../components/Dashboard/StatCard';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useTransactions } from '../hooks/useTransactions';
import { getMoneyVisible, setMoneyVisible } from '../utils/prefs';
import ConsultasDeHoje from "../components/Dashboard/ConsultasDeHoje";
import { supabase } from '../lib/supabase';
import EnablePushButton from '../components/EnablePushButton';
import PushTestButton from "../components/Dashboard/PushTestButton";


type FilterKind = 'today' | 'week';
type Props = {
  onOpenProfile?: () => void;
  firstName?: string;
  onGotoSchedule?: (filter: FilterKind) => void;
};

/** Parser consistente com o Finance.tsx (DD/MM/YYYY, ISO, Date) */
function parseBrDateToDate(s?: any): Date | null {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;

  if (typeof s === 'string') {
    // DD/MM/YYYY
    const mBR = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mBR) {
      const [_, dd, mm, yyyy] = mBR;
      const d = new Date(+yyyy, +mm - 1, +dd);
      return isNaN(d.getTime()) ? null : d;
    }
    // YYYY-MM-DD (ou ISO com tempo)
    const mISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mISO) {
      const [_, yyyy, mm, dd] = mISO;
      const d = new Date(+yyyy, +mm - 1, +dd);
      return isNaN(d.getTime()) ? null : d;
    }
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t);
  }
  return null;
}

/** Normaliza amount mesmo se vier string "1.234,56" ou "1234,56" */
function normalizeAmount(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const s = v.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Paleta estável para o donut */
const DONUT_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#14B8A6', '#F43F5E'];

const Dashboard: React.FC<Props> = ({ firstName, onGotoSchedule }) => {
  const { slots } = useAppointmentJourneys();
  const { transactions } = useTransactions();

  const todayFmt = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const todayDate = new Date().toISOString().split('T')[0];

  // ====== userId do usuário logado (para o botão de push) ======
  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let on = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!on) return;
      setUserId(data?.user?.id ?? null);
    });
    return () => { on = false; };
  }, []);
  // =============================================================

  // Atendimentos HOJE (finalizados/cancelados/no-show) → para abrir HISTÓRICO
  const todayAppointments = (slots || []).filter(
    (slot) =>
      slot.date === todayDate &&
      ['concluido', 'cancelado', 'no_show'].includes((slot.status || '').toLowerCase())
  );

  // Faltam hoje (pendentes) → abrir LISTA
  const todayPending = (slots || []).filter(
    (slot) =>
      slot.date === todayDate &&
      ['agendado', 'em_andamento'].includes((slot.status || '').toLowerCase())
  ).length;

  // Semana atual e a partir de amanhã
  const startOfWeek = new Date(); startOfWeek.setHours(0,0,0,0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23,59,59,999);
  const startTomorrow = new Date(); startTomorrow.setHours(0,0,0,0); startTomorrow.setDate(startTomorrow.getDate() + 1);

  const weeklyPending = (slots || []).filter((slot) => {
    const slotDate = new Date(`${slot.date}T12:00:00`);
    return (
      slotDate >= startTomorrow &&
      slotDate <= endOfWeek &&
      ['agendado', 'em_andamento'].includes((slot.status || '').toLowerCase())
    );
  });

  // ================= Receita do mês =================
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyRevenue = (transactions || [])
    .map((t: any) => {
      const rawDate = t?.date ?? t?.created_at ?? t?.createdAt ?? null;
      const d = parseBrDateToDate(rawDate);
      const amount = normalizeAmount(t?.amount);
      const type = (t?.type ?? '').toString().toLowerCase();
      const status = (t?.status ?? '').toString().toLowerCase();
      return { d, amount, type, status };
    })
    .filter(({ d, type, status }) => {
      if (!d || isNaN(d.getTime())) return false;
      const inMonth = d >= monthStart && d < nextMonthStart;
      const isIncome = type === 'income';
      const isPaid = status === 'paid';
      return inMonth && isIncome && isPaid;
    })
    .reduce((sum, { amount }) => sum + amount, 0);

  // Visibilidade (persiste)
  const [revenueVisible, setRevenueVisible] = React.useState<boolean>(() => getMoneyVisible());
  const toggleRevenue = () => {
    setRevenueVisible((v) => {
      const nv = !v;
      setMoneyVisible(nv);
      return nv;
    });
  };

  // Valor formatado (sempre string)
  const revenueStr = `R$ ${Number(monthlyRevenue).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

  // Próximo atendimento (1)
  const upcomingAppointments = (slots || [])
    .filter(
      (slot) =>
        slot.date >= todayDate &&
        ['agendado', 'em_andamento'].includes((slot.status || '').toLowerCase())
    )
    .sort((a, b) =>
      a.date === b.date
        ? a.startTime.localeCompare(b.startTime)
        : a.date.localeCompare(b.date)
    )
    .slice(0, 1);

  const CardButton: React.FC<
    React.PropsWithChildren<{ onClick: () => void; label: string }>
  > = ({ onClick, label, children }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={label}
      className="cursor-pointer rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30"
    >
      {children}
    </div>
  );

  /* ===================== Distribuição por Especialidade (180 dias) ===================== */
  type DonutItem = { name: string; value: number; color: string };
  const [distData, setDistData] = React.useState<DonutItem[]>([]);
  const [distLoading, setDistLoading] = React.useState(true);
  const timeframeDays = 180;

  React.useEffect(() => {
    let canceled = false;

    (async () => {
      setDistLoading(true);

      const from = new Date();
      from.setDate(from.getDate() - timeframeDays);
      const fromISO = from.toISOString();

      let rows: Array<{ specialty?: string | null; created_at?: string | null }> = [];
      let error: any = null;

      // 1) tenta filtrar por created_at
      try {
        const { data, error: e } = await supabase
          .from('patient_evolution')
          .select('specialty, created_at')
          .gte('created_at', fromISO);
        rows = data || [];
        error = e || null;
      } catch (e) {
        error = e;
      }

      // 2) fallback sem filtro se não houver created_at
      if (error) {
        try {
          const { data, error: e2 } = await supabase
            .from('patient_evolution')
            .select('specialty');
          rows = data || [];
          error = e2 || null;
        } catch (e2) {
          error = e2;
        }
      }

      if (canceled) return;

      if (error) {
        console.warn('patient_evolution fetch error:', error);
        setDistData([]);
        setDistLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      for (const r of rows) {
        const spec = String(r?.specialty || '').trim();
        if (!spec) continue;
        counts.set(spec, (counts.get(spec) || 0) + 1);
      }
      const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
      if (total === 0) {
        setDistData([]);
        setDistLoading(false);
        return;
      }

      const items: DonutItem[] = Array.from(counts.entries())
        .map(([name, count], idx) => ({
          name,
          value: Math.round((count / total) * 100),
          color: DONUT_COLORS[idx % DONUT_COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);

      setDistData(items);
      setDistLoading(false);
    })();

    return () => { canceled = true; };
  }, [timeframeDays]);

  return (
    <div className="p-6 pb-24 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-500 capitalize">{todayFmt}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {firstName ? (
              <>Seja bem-vindo <span className="text-blue-700">{firstName}</span></>
            ) : (
              <>Seja bem-vindo</>
            )}
          </h1>
        </div>

        {/* Botão de Notificações (lado direito do header) */}
        <div className="flex items-center">
          {userId && (
            <div className="block sm:block ml-2">
              <EnablePushButton userId={userId} />
              <PushTestButton userId={userId} />


            </div>
          )}
        </div>
      </div>
      

      {/* KPIs topo */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Atendimentos Hoje → ABRE HISTÓRICO de hoje */}
        <CardButton
          onClick={() => {
            sessionStorage.setItem('schedule:openHistory','today');
            onGotoSchedule?.('today');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('agenda:openHistory', { detail: { range: 'today' } }));
            }, 50);
          }}
          label="Ver atendimentos de hoje"
        >
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <StatCard title="Atendimentos Hoje" value={todayAppointments.length} icon={Users} color="blue" />
          </div>
        </CardButton>

        {/* Faltam Hoje → ABRE LISTA */}
        <CardButton
          onClick={() => {
            sessionStorage.removeItem('schedule:openHistory');
            onGotoSchedule?.('today');
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('agenda:closeHistory'));
              window.dispatchEvent(new CustomEvent('agenda:filter', { detail: 'today' }));
            }, 50);
          }}
          label="Ver pendentes de hoje"
        >
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <StatCard title="Faltam Hoje" value={todayPending} icon={Users} color="purple" />
          </div>
        </CardButton>
      </div>

      {/* Receita do Mês */}
      <div className="mb-4">
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <button
            type="button"
            onClick={toggleRevenue}
            className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-slate-100 text-slate-600 z-10"
            title={revenueVisible ? 'Ocultar' : 'Mostrar'}
            aria-label={revenueVisible ? 'Ocultar receita' : 'Mostrar receita'}
          >
            {revenueVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>

          <StatCard
            title="Receita do Mês"
            value={revenueStr}
            icon={DollarSign}
            color="green"
            maskDigits={!revenueVisible}
          />
        </div>
      </div>

      {/* Semanais */}
      <div className="mb-8">
        <CardButton onClick={() => onGotoSchedule?.('week')} label="Ver atendimentos da semana">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <StatCard title="Atendimentos Semanais" value={weeklyPending.length} icon={Calendar} color="orange" />
          </div>
        </CardButton>
      </div>

      {/* Distribuição por Especialidade (últimos 180 dias) */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 pt-5 pb-3">
            <h2 className="text-lg font-semibold text-slate-900">Distribuição por Especialidade</h2>
            <p className="text-xs text-slate-500 mt-1">Baseado em evoluções (concluídos){' '}
              <span className="whitespace-nowrap">• últimos {timeframeDays} dias</span>
            </p>
          </div>

          {distLoading ? (
            <div className="px-6 pb-6 text-slate-500">Carregando…</div>
          ) : distData.length === 0 ? (
            <div className="px-6 pb-6 text-slate-500">Sem dados no período.</div>
          ) : (
            <div className="px-2 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              {/* Donut */}
              <div className="h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                      isAnimationActive
                    >
                      {distData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda */}
              <div className="px-4 sm:px-2 space-y-3">
                {distData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Ações Rápidas</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {/* Nova Consulta */}
            <li>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('schedule:openHistory');
                  onGotoSchedule?.('today');
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('agenda:closeHistory'));
                    window.dispatchEvent(new CustomEvent('agenda:new'));
                  }, 50);
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex w-8 h-8 rounded-xl bg-blue-100 text-blue-700 items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M7 11h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2zM5 21q-.825 0-1.412-.587T3 19V7q0-.825.588-1.412T5 5h1V3h2v2h8V3h2v2h1q.825 0 1.413.588T21 7v12q0 .825-.587 1.413T19 21zM5 19h14V9H5z"/></svg>
                  </span>
                  <span className="text-slate-900 font-medium">Nova Consulta</span>
                </span>
                <span className="text-slate-400">›</span>
              </button>
            </li>

            {/* Novo Paciente */}
            <li>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('patients:new'));
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex w-8 h-8 rounded-xl bg-purple-100 text-purple-700 items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M8 11q-1.65 0-2.825-1.175T4 7q0-1.65 1.175-2.825T8 3t2.825 1.175T12 7t-1.175 2.825T8 11m8 1v-2h-2V8h2V6h2v2h2v2h-2v2zm-8 2q2.1 0 3.975.8T15 16.9V19H1v-2.1q.8-1.05 2.675-1.85T8 14"/></svg>
                  </span>
                  <span className="text-slate-900 font-medium">Novo Paciente</span>
                </span>
                <span className="text-slate-400">›</span>
              </button>
            </li>

            {/* Gerar Atestado */}
            <li>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('certificate:new'));
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex w-8 h-8 rounded-xl bg-green-100 text-green-700 items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6q-.825 0-1.412.588T4 4v16q0 .825.588 1.413T6 22h12q.825 0 1.413-.587T20 20V8zm-2 6V4l4 4z"/></svg>
                  </span>
                  <span className="text-slate-900 font-medium">Gerar Atestado</span>
                </span>
                <span className="text-slate-400">›</span>
              </button>
            </li>

            {/* Ver Relatórios */}
            <li>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('reports:open'));
                }}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex w-8 h-8 rounded-xl bg-orange-100 text-orange-700 items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M3 21V3h2v16h16v2zm4 0V9h2v12zm4 0V3h2v18zm4 0v-8h2v8z"/></svg>
                  </span>
                  <span className="text-slate-900 font-medium">Ver Relatórios</span>
                </span>
                <span className="text-slate-400">›</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Consultas de Hoje (bloco de tabela) */}
      <ConsultasDeHoje onGotoSchedule={onGotoSchedule} />

      {/* Próximos Atendimentos */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Próximos Atendimentos</h2>
        <div className="space-y-3">
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((slot) => {
              const formattedDate = new Date(`${slot.date}T12:00:00`).toLocaleDateString('pt-BR', {
                day: 'numeric', month: 'short',
              });
              return (
                <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 leading-tight truncate">
                        {slot.patientName || 'Paciente não definido'}
                      </h3>
                      <p className="text-slate-600 text-sm truncate">{slot.service}</p>
                      <p className="text-blue-700 text-sm font-medium">
                        {formattedDate} • {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span
                        className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${
                          (slot.status || '').toLowerCase() === 'agendado'
                            ? 'bg-blue-100 text-blue-700'
                            : (slot.status || '').toLowerCase() === 'em_andamento'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {(slot.status || '').toLowerCase() === 'agendado'
                          ? 'Agendado'
                          : 'Em Andamento'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <p className="text-slate-500 text-center">Nenhum atendimento agendado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
