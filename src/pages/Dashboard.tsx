import React from 'react';
import { Users, DollarSign, Calendar, Eye, EyeOff } from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useTransactions } from '../hooks/useTransactions';
import { getMoneyVisible, setMoneyVisible } from '../utils/prefs';
import OverlayMenu from "../components/common/OverlayMenu";

type FilterKind = 'today' | 'week';
type Props = {
  onOpenProfile?: () => void;
  firstName?: string;
  onGotoSchedule?: (filter: FilterKind) => void;
};

function parseToDate(s?: string | null) {
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const Dashboard: React.FC<Props> = ({ onOpenProfile, firstName, onGotoSchedule }) => {
  const { slots } = useAppointmentJourneys();
  const { transactions } = useTransactions();

  const todayFmt = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const todayDate = new Date().toISOString().split('T')[0];

  // Atendimentos HOJE (igual Histórico/Dia: finalizados)
  const todayAppointments = slots.filter(
    (slot) => slot.date === todayDate && ['concluido', 'cancelado', 'no_show'].includes(slot.status)
  );

  // Faltam hoje (pendentes)
  const todayPending = slots.filter(
    (slot) => slot.date === todayDate && ['agendado', 'em_andamento'].includes(slot.status)
  ).length;

  // Semana atual e a partir de amanhã
  const startOfWeek = new Date(); startOfWeek.setHours(0,0,0,0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999);
  const startTomorrow = new Date(); startTomorrow.setHours(0,0,0,0); startTomorrow.setDate(startTomorrow.getDate() + 1);

  const weeklyPending = slots.filter((slot) => {
    const slotDate = new Date(`${slot.date}T12:00:00`);
    return slotDate >= startTomorrow && slotDate <= endOfWeek &&
           ['agendado', 'em_andamento'].includes(slot.status);
  });

  // Receita do mês (pagas)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const isPaid = (t: any) => (t?.status ?? 'pending') === 'paid';

  const monthlyRevenue = transactions
    .filter((t) => t.type === 'income' && isPaid(t))
    .filter((t) => {
      const d = parseToDate(t.date);
      return d ? d >= monthStart && d < nextMonthStart : true;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  // Visibilidade (persiste)
  const [revenueVisible, setRevenueVisible] = React.useState<boolean>(() => getMoneyVisible());
  const toggleRevenue = () => {
    setRevenueVisible(v => {
      const nv = !v;
      setMoneyVisible(nv);   // persiste na mesma chave
      return nv;
    });
  };

  // Valor formatado (sempre string)
  const revenueStr = `R$ ${monthlyRevenue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

  // Próximo atendimento (1)
  const upcomingAppointments = slots
    .filter((slot) => slot.date >= todayDate && ['agendado', 'em_andamento'].includes(slot.status))
    .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    .slice(0, 1);

  const CardButton: React.FC<React.PropsWithChildren<{ onClick: () => void; label: string }>> =
    ({ onClick, label, children }) => (
      <div role="button" tabIndex={0} onClick={onClick}
           onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
           aria-label={label}
           className="cursor-pointer rounded-2xl outline-none focus:ring-2 focus:ring-blue-500/30">
        {children}
      </div>
    );

  // handler para o item "Perfil" do menu
  const handleOpenProfile = () => {
    if (onOpenProfile) onOpenProfile();
    else window.dispatchEvent(new CustomEvent('open:profile'));
  };

  return (
    <div className="p-6 pb-24 min-h-screen bg-slate-50">
      {/* Ícone/menu suspenso no topo direito (estilo do mockup) */}
      <OverlayMenu onOpenProfile={handleOpenProfile} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-500 capitalize">{todayFmt}</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {firstName ? <>Seja bem-vindo <span className="text-blue-700">{firstName}</span></> : <>Seja bem-vindo</>}
          </h1>
        </div>
        {/* Removido o botão antigo de perfil; agora o acesso é pelo OverlayMenu */}
        <div className="w-10 h-10" />
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <CardButton onClick={() => { onGotoSchedule?.('today'); setTimeout(() => { window.dispatchEvent(new Event('agenda:history')); }, 0); }}
                    label="Ver atendimentos de hoje">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <StatCard title="Atendimentos Hoje" value={todayAppointments.length} icon={Users} color="blue" />
          </div>
        </CardButton>

        <CardButton onClick={() => onGotoSchedule?.('today')} label="Ver pendentes de hoje">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <StatCard title="Faltam Hoje" value={todayPending} icon={Users} color="purple" />
          </div>
        </CardButton>
      </div>

      {/* Receita do Mês (mascara de dígitos) */}
      <div className="mb-4">
        <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
          <button type="button" onClick={toggleRevenue}
                  className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-slate-100 text-slate-600 z-10"
                  title={revenueVisible ? 'Ocultar' : 'Mostrar'}
                  aria-label={revenueVisible ? 'Ocultar receita' : 'Mostrar receita'}>
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

      {/* Próximos Atendimentos */}
      <div>
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
                      <span className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${
                        slot.status === 'agendado'
                          ? 'bg-blue-100 text-blue-700'
                          : slot.status === 'em_andamento'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {slot.status === 'agendado'
                          ? 'Agendado'
                          : slot.status === 'em_andamento'
                          ? 'Em Andamento'
                          : 'Concluído'}
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
