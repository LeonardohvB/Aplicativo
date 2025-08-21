import React from 'react';
import { TrendingUp, TrendingDown, Percent, Users, Calendar, DollarSign, Clock, CheckCircle } from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import { useProfessionals } from '../hooks/useProfessionals';
import { useTransactions } from '../hooks/useTransactions';
import { useAppointmentHistory } from '../hooks/useAppointmentHistory';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';

const Reports: React.FC = () => {
  const { professionals } = useProfessionals();
  const { transactions } = useTransactions();
  const { history, getHistoryStats, getHistoryByDateRange } = useAppointmentHistory();
  const { slots } = useAppointmentJourneys();

  // Data de hoje
  const today = new Date().toISOString().split('T')[0];
  
  // Início e fim da semana atual
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

  // Estatísticas do histórico
  const historyStats = getHistoryStats();
  
  // Atendimentos de hoje (do histórico)
  const todayHistory = history.filter(h => h.date === today);
  const todayCompletedAppointments = todayHistory.filter(h => h.status === 'concluido').length;
  const todayTotalAppointments = todayHistory.length;
  
  // Atendimentos da semana (do histórico)
  const weekHistory = getHistoryByDateRange(startOfWeekStr, endOfWeekStr);
  const weekCompletedAppointments = weekHistory.filter(h => h.status === 'concluido').length;
  const weekTotalAppointments = weekHistory.length;
  
  // Atendimentos agendados para hoje (dos slots)
  const todayScheduledSlots = slots.filter(slot => 
    slot.date === today && 
    ['agendado', 'em_andamento'].includes(slot.status)
  );
  
  // Receita do histórico (apenas atendimentos concluídos)
  const completedHistory = history.filter(h => h.status === 'concluido');
  const clinicRevenue = completedHistory.reduce((sum, h) => sum + (h.price * (h.clinicPercentage / 100)), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  // Receita total da clínica (todas as transações de receita)
  const totalRevenue = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  // Margem de lucro baseada em toda a receita da clínica
  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0.0';
  
  // Total de pacientes únicos do histórico
  const uniquePatients = new Set(history.map(h => h.patientName.toLowerCase())).size;
  
  // Relatório por profissional baseado no histórico
  const professionalReports = professionals.map(prof => {
    const profHistory = history.filter(h => h.professionalId === prof.id && h.status === 'concluido');
    const uniqueProfPatients = new Set(profHistory.map(h => h.patientName.toLowerCase())).size;
    const totalAttendanceValue = profHistory.reduce((sum, h) => sum + h.price, 0);
    const clinicCommission = profHistory.reduce((sum, h) => sum + (h.price * (h.clinicPercentage / 100)), 0);
    
    return {
      name: prof.name,
      specialty: prof.specialty,
      patients: uniqueProfPatients,
      attendanceValue: totalAttendanceValue,
      commission: clinicCommission,
      totalAppointments: profHistory.length,
    };
  });

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatórios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Atendimentos Hoje"
          value={`${todayCompletedAppointments}/${todayTotalAppointments + todayScheduledSlots.length}`}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Atendimentos Semana"
          value={`${weekCompletedAppointments}/${weekTotalAppointments}`}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Receita Total"
          value={`R$ ${totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Despesas Totais"
          value={`R$ ${totalExpenses.toFixed(2)}`}
          icon={TrendingDown}
          color="orange"
        />
        <StatCard
          title="Margem de Lucro"
          value={`${profitMargin}%`}
          icon={Percent}
          color="blue"
        />
        <StatCard
          title="Total de Pacientes"
          value={uniquePatients}
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Comissões Totais"
          value={`R$ ${clinicRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="Taxa de Conclusão"
          value={`${historyStats.completionRate.toFixed(1)}%`}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Resumo do Dia */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Dia</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-blue-600 font-semibold text-2xl">{todayCompletedAppointments}</p>
            <p className="text-gray-500 text-sm">Concluídos</p>
          </div>
          <div className="text-center">
            <p className="text-yellow-600 font-semibold text-2xl">{todayScheduledSlots.length}</p>
            <p className="text-gray-500 text-sm">Agendados</p>
          </div>
          <div className="text-center">
            <p className="text-orange-600 font-semibold text-2xl">
              {todayHistory.filter(h => h.status === 'no_show').length}
            </p>
            <p className="text-gray-500 text-sm">Faltaram</p>
          </div>
          <div className="text-center">
            <p className="text-green-600 font-semibold text-2xl">
              R$ {todayHistory.filter(h => h.status === 'concluido').reduce((sum, h) => sum + (h.price * (h.clinicPercentage / 100)), 0).toFixed(0)}
            </p>
            <p className="text-gray-500 text-sm">Receita</p>
          </div>
          <div className="text-center">
            <p className="text-purple-600 font-semibold text-2xl">
              {todayTotalAppointments > 0 ? ((todayCompletedAppointments / todayTotalAppointments) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-gray-500 text-sm">Taxa Conclusão</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Resumo por Profissional</h2>
        <div className="space-y-6">
          {professionalReports.map((prof, index) => (
            <div key={index} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{prof.name}</h3>
                  <p className="text-gray-600 text-sm">{prof.specialty}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{prof.totalAppointments} atendimentos</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Pacientes</p>
                  <p className="text-blue-600 font-semibold text-lg">{prof.patients}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Atendimentos</p>
                  <p className="text-blue-600 font-semibold text-lg">R$ {prof.attendanceValue.toFixed(0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-sm mb-1">Comissão</p>
                  <p className="text-blue-600 font-semibold text-lg">R$ {prof.commission.toFixed(0)}</p>
                </div>
              </div>
            </div>
          ))}
          {professionalReports.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum dado de profissional disponível ainda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;