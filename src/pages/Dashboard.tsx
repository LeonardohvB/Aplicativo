import React from 'react';
import { Users, DollarSign, Calendar, UserCircle2 } from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { useTransactions } from '../hooks/useTransactions';

type FilterKind = 'today' | 'week';
type Props = {
  onOpenProfile?: () => void;
  firstName?: string;
  onGotoSchedule?: (filter: FilterKind) => void;
};

function parseToDate(s?: string | null) {
  if (!s) return null;
  // DD/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  // ISO ou outros formatos aceitos pelo Date
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const Dashboard: React.FC<Props> = ({ onOpenProfile, firstName, onGotoSchedule }) => {
  const { slots } = useAppointmentJourneys();
  const { transactions } = useTransactions();

  const todayFmt = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const todayDate = new Date().toISOString().split('T')[0];

  const todayAppointments = slots.filter(
    (slot) =>
      slot.date === todayDate &&
      ['agendado', 'em_andamento', 'concluido'].includes(slot.status)
  );

  // Semana atual (Dom–Sáb)
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const weeklyAppointments = slots.filter((slot) => {
    const slotDate = new Date(slot.date);
    return (
      slotDate >= startOfWeek &&
      slotDate <= endOfWeek &&
      ['agendado', 'em_andamento', 'concluido'].includes(slot.status)
    );
  });

  // ==== RECEITA DO MÊS (APENAS PAGAS) ====
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const isPaid = (t: any) => ((t?.status ?? 'pending') === 'paid');

  const monthlyRevenue = transactions
    .filter((t) => t.type === 'income' && isPaid(t))
    .filter((t) => {
      const d = parseToDate(t.date);
      return d ? d >= monthStart && d < nextMonthStart : true; // se não der pra parsear, não bloqueia
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const upcomingAppointments = slots
    .filter(
      (slot) =>
        slot.date >= todayDate &&
        ['agendado', 'em_andamento'].includes(slot.status)
    )
    .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
    .slice(0, 3);

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
      className="cursor-pointer rounded-xl outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      {children}
    </div>
  );

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600 capitalize">{todayFmt}</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {firstName ? (
              <>Seja bem-vindo <span className="text-blue-700">{firstName}</span></>
            ) : (
              <>Seja bem-vindo</>
            )}
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="Abrir perfil"
          className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm active:scale-95 transition"
          title="Perfil"
        >
          <UserCircle2 className="w-6 h-6 text-gray-700" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <CardButton
          onClick={() => onGotoSchedule?.('today')}
          label="Ver atendimentos de hoje"
        >
          <StatCard title="Atendimentos Hoje" value={todayAppointments.length} icon={Users} color="blue" />
        </CardButton>

        {/* Agora reflete o Financeiro: soma APENAS receitas pagas do mês */}
        <StatCard
          title="Receita do Mês"
          value={`R$ ${monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="green"
        />

        <CardButton
          onClick={() => onGotoSchedule?.('week')}
          label="Ver atendimentos da semana"
        >
          <StatCard title="Atendimentos Semanais" value={weeklyAppointments.length} icon={Calendar} color="orange" />
        </CardButton>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Próximos Atendimentos</h2>
        <div className="space-y-3">
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((slot) => {
              const formattedDate = new Date(`${slot.date}T12:00:00`).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'short',
              });
              return (
                <div key={slot.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{slot.patientName || 'Paciente não definido'}</h3>
                      <p className="text-gray-600 text-sm">{slot.service}</p>
                      <p className="text-blue-600 text-sm font-medium">{formattedDate} • {slot.startTime} - {slot.endTime}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        slot.status === 'agendado'
                          ? 'bg-blue-100 text-blue-700'
                          : slot.status === 'em_andamento'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {slot.status === 'agendado' ? 'Agendado' : slot.status === 'em_andamento' ? 'Em Andamento' : 'Concluído'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-center">Nenhum atendimento agendado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
