import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Percent, Users, Calendar, DollarSign, Clock, CheckCircle, Download
} from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import { useProfessionals } from '../hooks/useProfessionals';
import { useTransactions } from '../hooks/useTransactions';
import { useAppointmentHistory } from '../hooks/useAppointmentHistory';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { supabase } from '../lib/supabase';

// PDF
import { pdf } from '@react-pdf/renderer';
import ReportDocument, { Row as PdfRow } from '../ReportDocument';

// helper local para data "YYYY-MM-DD" em fuso local
const todayLocalISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// ===== Helpers de filtro/normalização =====
const byOwner = <T extends Record<string, any>>(arr: T[], uid: string | null): T[] => {
  if (!uid || !Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  const hasOwner = arr.some(it => 'owner_id' in it);
  return hasOwner ? arr.filter(it => it.owner_id === uid) : arr; // se não tiver owner_id, confia no RLS
};
const isIncome  = (t?: string) => (t ?? '').toLowerCase() === 'income';
const isExpense = (t?: string) => (t ?? '').toLowerCase() === 'expense';
const isDone    = (s?: string) => (s ?? '').toLowerCase() === 'concluido';
const isNoShow  = (s?: string) => (s ?? '').toLowerCase() === 'no_show';

const DateInput: React.FC<{
  label: string;
  value: string;                // yyyy-mm-dd
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex flex-col min-w-[180px] print:min-w-[200px]">
    <span className="text-xs text-gray-500 mb-1">{label}</span>
    <div className="relative">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
        aria-hidden
      />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full pr-3 pl-9 py-2 rounded-xl border border-gray-200 bg-white
          text-sm text-gray-900
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          print:rounded-md print:py-1.5 print:text-base print:border-gray-300
        "
      />
    </div>
  </div>
);

const Reports: React.FC = () => {
  // Pega o uid de forma não bloqueante
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) console.warn('getUser error:', error);
        if (alive) setUid(data.user?.id ?? null);
      } catch (e) {
        console.warn('getUser fatal:', e);
        if (alive) setUid(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const { professionals } = useProfessionals();
  const { transactions } = useTransactions();
  const { history, getHistoryStats, getHistoryByDateRange } = useAppointmentHistory();
  const { slots } = useAppointmentJourneys();

  // Filtra tudo por dono (se não houver owner_id nos itens, retorna o array "como veio")
  const myHistory      = useMemo(() => byOwner(history, uid),      [history, uid]);
  const myTransactions = useMemo(() => byOwner(transactions, uid), [transactions, uid]);
  const mySlots        = useMemo(() => byOwner(slots, uid),        [slots, uid]);

  // Filtros do PDF
  const [from, setFrom] = useState(todayLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const today = todayLocalISO();

  // Semana atual (local)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const endOfWeekStr = endOfWeek.toISOString().slice(0, 10);

  // Estatísticas do histórico (se hook falhar, retorna 0)
  const historyStats = useMemo(() => {
    try {
      const s = getHistoryStats?.();
      return s ?? { completionRate: 0 };
    } catch {
      return { completionRate: 0 };
    }
  }, [getHistoryStats]);

  // Atendimentos de hoje (somente meus)
  const todayHistory = myHistory.filter(h => h.date === today);
  const todayCompletedAppointments = todayHistory.filter(h => isDone(h.status)).length;
  const todayTotalAppointments = todayHistory.length;

  // Semana (somente meus)
  const baseWeek = getHistoryByDateRange
    ? (getHistoryByDateRange(startOfWeekStr, endOfWeekStr) ?? [])
    : myHistory.filter(h => h.date >= startOfWeekStr && h.date <= endOfWeekStr);
  const weekHistory = baseWeek.filter((h: any) => !('owner_id' in h) || h.owner_id === uid);
  const weekCompletedAppointments = weekHistory.filter(h => isDone(h.status)).length;
  const weekTotalAppointments = weekHistory.length;

  // Slots de hoje (somente meus)
  const todayScheduledSlots = mySlots.filter(s =>
    s.date === today && ['agendado', 'em_andamento'].includes((s.status ?? '').toLowerCase())
  );

  // Receita (somente meus) — números seguros
  const completedHistory = myHistory.filter(h => isDone(h.status));
  const clinicRevenue = completedHistory.reduce((sum, h) =>
    sum + (Number(h.price) || 0) * ((Number(h.clinicPercentage) || 0) / 100), 0);

  const totalExpenses = myTransactions
    .filter(t => isExpense(t.type))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalRevenue = myTransactions
    .filter(t => isIncome(t.type))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : '0.0';

  // Pacientes únicos (somente meus)
  const uniquePatients = new Set(
    myHistory.map(h => (h.patientName ?? '').toString().toLowerCase())
  ).size;

  // Relatório por profissional (apenas com meu histórico)
  const professionalReports = useMemo(() => {
    return professionals.map((prof: any) => {
      const profHistory = completedHistory.filter(h => h.professionalId === prof.id);
      const uniqueProfPatients = new Set(profHistory.map(h => (h.patientName ?? '').toString().toLowerCase())).size;
      const totalAttendanceValue = profHistory.reduce((sum, h) => sum + (Number(h.price) || 0), 0);
      const clinicCommission = profHistory.reduce((sum, h) =>
        sum + ((Number(h.price) || 0) * ((Number(h.clinicPercentage) || 0) / 100)), 0);

      return {
        name: prof.name,
        specialty: prof.specialty,
        patients: uniqueProfPatients,
        attendanceValue: totalAttendanceValue,
        commission: clinicCommission,
        totalAppointments: profHistory.length,
      };
    });
  }, [professionals, completedHistory]);

  // nome do profissional por id (para PDF)
  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of professionals) map[p.id] = p.name;
    return map;
  }, [professionals]);

  // Exportar PDF (usa apenas meu histórico)
  const handleExportPdf = async () => {
    const range = myHistory.filter(h => h.date >= from && h.date <= to);

    const byStatus: Record<string, number> = {};
    let revenue = 0;
    for (const h of range) {
      const st = (h.status ?? '').toLowerCase();
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (isDone(st)) {
        revenue += (Number(h.price) || 0) * ((Number(h.clinicPercentage) || 0) / 100);
      }
    }

    const rows: PdfRow[] = range
      .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))
      .map(h => ({
        date: h.date,
        time: (h.startTime && h.endTime) ? `${h.startTime}–${h.endTime}` : (h.startTime || ''),
        professional: h.professionalId ? nameById[h.professionalId] : undefined,
        patient: h.patientName || undefined,
        status: (h.status ?? '').toLowerCase(),
        price: Number(h.price) || null,
      }));

    const blob = await pdf(
      <ReportDocument
        title="Relatório de Atendimentos"
        generatedAt={new Date().toLocaleString()}
        summary={{
          periodLabel: `${from} a ${to}`,
          total: rows.length,
          byStatus,
          revenue,
        }}
        rows={rows}
      />
    ).toBlob();

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${from}_a_${to}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* Cabeçalho */}
      <div
        className="
          flex flex-col gap-3 mb-6
          md:flex-row md:items-end md:justify-between
          print:flex-row print:items-center print:justify-between print:mb-3
        "
      >
        <h1 className="text-2xl font-bold text-gray-900 print:text-[20pt] print:font-extrabold">
          Relatórios
        </h1>

        <div className="flex flex-wrap items-end gap-3 print:gap-2">
          <DateInput label="Data inicial" value={from} onChange={setFrom} />
          <DateInput label="Data final" value={to} onChange={setTo} />
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 print:px-3 print:py-1.5"
            title="Gerar PDF"
          >
            <Download size={18} /> Gerar PDF
          </button>
        </div>
      </div>

      {/* Cards principais */}
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
          value={`${(historyStats?.completionRate ?? 0).toFixed(1)}%`}
          icon={CheckCircle}
          color="green"
        />
      </div>

      {/* Resumo por Profissional */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100
                      print:shadow-none print:border-gray-300 print:rounded-md print:break-inside-avoid">
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
