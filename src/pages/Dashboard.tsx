// src/pages/Dashboard.tsx
import React from "react";
import { Users, DollarSign, Calendar, Eye, EyeOff } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import { useAppointmentJourneys } from "../hooks/useAppointmentJourneys";
import { useTransactions } from "../hooks/useTransactions";
import { getMoneyVisible, setMoneyVisible } from "../utils/prefs";
import ConsultasDeHoje from "../components/Dashboard/ConsultasDeHoje";
import { supabase } from "../lib/supabase";
import EnablePushButton from "../components/EnablePushButton";
import PushTestButton from "../components/Dashboard/PushTestButton";
import { CalendarPlus, UserPlus, FileText, BarChart3 } from "lucide-react";


// Layout base
import Page from "../components/Layout/Page";
// Removidos: ResponsiveGrid e KpiCard
import Surface from "../components/ui/Surface";
import StatCard from "../components/Dashboard/StatCard";

type FilterKind = "today" | "week";
type Props = {
  onOpenProfile?: () => void;
  firstName?: string;
  onGotoSchedule?: (filter: FilterKind) => void;
};

/** Parser consistente com o Finance.tsx (DD/MM/YYYY, ISO, Date) */
function parseBrDateToDate(s?: any): Date | null {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;

  if (typeof s === "string") {
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
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const s = v.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Paleta estável para o donut */
const DONUT_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#3B82F6", "#14B8A6", "#F43F5E"];

const Dashboard: React.FC<Props> = ({ firstName, onGotoSchedule }) => {
  const { slots } = useAppointmentJourneys();
  const { transactions } = useTransactions();

  const todayFmt = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const todayDate = new Date().toISOString().split("T")[0];

  // ====== userId do usuário logado (para os botões de push) ======
  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let on = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!on) return;
      setUserId(data?.user?.id ?? null);
    });
    return () => {
      on = false;
    };
  }, []);
  // ===============================================================

  // Atendimentos HOJE (finalizados/cancelados/no-show) → abrir HISTÓRICO
  const todayAppointments = (slots || []).filter(
    (slot) =>
      slot.date === todayDate &&
      ["concluido", "cancelado", "no_show"].includes((slot.status || "").toLowerCase())
  );

  // Faltam hoje (pendentes) → abrir LISTA
  const todayPending = (slots || []).filter(
    (slot) =>
      slot.date === todayDate &&
      ["agendado", "em_andamento"].includes((slot.status || "").toLowerCase())
  ).length;

  // Semana atual e a partir de amanhã
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  const startTomorrow = new Date();
  startTomorrow.setHours(0, 0, 0, 0);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const weeklyPending = (slots || []).filter((slot) => {
    const slotDate = new Date(`${slot.date}T12:00:00`);
    return (
      slotDate >= startTomorrow &&
      slotDate <= endOfWeek &&
      ["agendado", "em_andamento"].includes((slot.status || "").toLowerCase())
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
      const type = (t?.type ?? "").toString().toLowerCase();
      const status = (t?.status ?? "").toString().toLowerCase();
      return { d, amount, type, status };
    })
    .filter(({ d, type, status }) => {
      if (!d || isNaN(d.getTime())) return false;
      const inMonth = d >= monthStart && d < nextMonthStart;
      const isIncome = type === "income";
      const isPaid = status === "paid";
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
  const revenueStr = `R$ ${Number(monthlyRevenue).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Próximo atendimento (1)
  const upcomingAppointments = (slots || [])
    .filter(
      (slot) =>
        slot.date >= todayDate &&
        ["agendado", "em_andamento"].includes((slot.status || "").toLowerCase())
    )
    .sort((a, b) =>
      a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)
    )
    .slice(0, 1);

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
          .from("patient_evolution")
          .select("specialty, created_at")
          .gte("created_at", fromISO);
        rows = data || [];
        error = e || null;
      } catch (e) {
        error = e;
      }

      // 2) fallback sem filtro se não houver created_at
      if (error) {
        try {
          const { data, error: e2 } = await supabase.from("patient_evolution").select("specialty");
          rows = data || [];
          error = e2 || null;
        } catch (e2) {
          error = e2;
        }
      }

      if (canceled) return;

      if (error) {
        console.warn("patient_evolution fetch error:", error);
        setDistData([]);
        setDistLoading(false);
        return;
      }

      const counts = new Map<string, number>();
      for (const r of rows) {
        const spec = String(r?.specialty || "").trim();
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

    return () => {
      canceled = true;
    };
  }, [timeframeDays]);

  return (
    <Page
      // fullWidth: usa 100% da largura no desktop. Remova se quiser limitar em max-w-7xl.
      fullWidth
      subtitle={<span className="capitalize">{todayFmt}</span>}
      title={
        <>
          Seja bem-vindo{" "}
          {firstName ? <span className="text-blue-700">{firstName}</span> : null}
        </>
      }
      actions={
        userId ? (
          <div className="flex items-center gap-2">
            <EnablePushButton userId={userId} />
            <PushTestButton userId={userId} />
          </div>
        ) : null
      }
    >
      <section className="mb-6">
  {/* 2 col no mobile, 4 no desktop */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
    {/* 1) Atendimentos Hoje */}
    <Surface className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          sessionStorage.setItem("schedule:openHistory", "today");
          onGotoSchedule?.("today");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("agenda:openHistory", { detail: { range: "today" } }));
          }, 50);
        }}
        className="cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/30 block"
        aria-label="Ver atendimentos de hoje"
      >
        <StatCard title="Atendimentos Hoje" value={todayAppointments.length} icon={Users} color="blue" />
      </div>
    </Surface>

    {/* 2) Faltam Hoje */}
    <Surface className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          sessionStorage.removeItem("schedule:openHistory");
          onGotoSchedule?.("today");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("agenda:closeHistory"));
            window.dispatchEvent(new CustomEvent("agenda:filter", { detail: "today" }));
          }, 50);
        }}
        className="cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/30 block"
        aria-label="Ver pendentes de hoje"
      >
        <StatCard title="Faltam Hoje" value={todayPending} icon={Users} color="purple" />
      </div>
    </Surface>

    {/* 3) Receita do Mês (com botão olho por cima do mesmo Surface) */}
    <Surface className="h-full relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleRevenue(); }}
        className="absolute right-3 top-3 rounded-md p-1.5 hover:bg-slate-100 text-slate-600 z-10"
        title={revenueVisible ? "Ocultar" : "Mostrar"}
        aria-label={revenueVisible ? "Ocultar receita" : "Mostrar receita"}
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
    </Surface>

    {/* 4) Atendimentos Semanais */}
    <Surface className="h-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onGotoSchedule?.("week")}
        className="cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/30 block"
        aria-label="Ver atendimentos da semana"
      >
        <StatCard title="Atendimentos Semanais" value={weeklyPending.length} icon={Calendar} color="orange" />
      </div>
    </Surface>
  </div>
</section>


      {/* “Miolo” aproveitando largura — metade/metade no desktop */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-6">
  {/* Distribuição por Especialidade → largura de 2 KPIs (6/12) */}
  <div className="xl:col-span-6">
    <Surface className="h-full">
      <div className="px-1 sm:px-2">
        <h2 className="text-lg font-semibold text-slate-900">Distribuição por Especialidade</h2>
        <p className="text-xs text-slate-500 mt-1">
          Baseado em evoluções (concluídos) • últimos {timeframeDays} dias
        </p>
      </div>

      {distLoading ? (
        <div className="px-1 sm:px-2 py-6 text-slate-500">Carregando…</div>
      ) : distData.length === 0 ? (
        <div className="px-1 sm:px-2 py-10 text-slate-500">Sem dados no período.</div>
      ) : (
        <div className="px-1 sm:px-2 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
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
          <div className="px-1 sm:px-2 space-y-3">
            {distData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-slate-700 truncate">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Surface>
  </div>

  {/* Ações Rápidas → largura de 2 KPIs (6/12) em GRID 2x2 */}
  <div className="xl:col-span-6">
    <Surface padded={false} className="h-full">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Ações Rápidas</h2>
      </div>

      {/* grid 2 colunas no desktop; 1 coluna no mobile */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Nova Consulta */}
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem("schedule:openHistory");
            onGotoSchedule?.("today");
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("agenda:closeHistory"));
              window.dispatchEvent(new CustomEvent("agenda:new"));
            }, 50);
          }}
          className="w-full px-4 py-4 flex items-center justify-between rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition"
        >
          <span className="flex items-center gap-3">
          <span className="inline-flex w-9 h-9 rounded-xl bg-blue-100 text-blue-700 items-center justify-center">
  <CalendarPlus className="w-5 h-5" />
</span>
            <span className="text-slate-900 font-medium">Nova Consulta</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>

        {/* Novo Paciente */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("patients:new"))}
          className="w-full px-4 py-4 flex items-center justify-between rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition"
        >
          <span className="flex items-center gap-3">
           <span className="inline-flex w-9 h-9 rounded-xl bg-purple-100 text-purple-700 items-center justify-center">
  <UserPlus className="w-5 h-5" />
</span>
            <span className="text-slate-900 font-medium">Novo Paciente</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>

        {/* Gerar Atestado */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("certificate:new"))}
          className="w-full px-4 py-4 flex items-center justify-between rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition"
        >
          <span className="flex items-center gap-3">
           <span className="inline-flex w-9 h-9 rounded-xl bg-green-100 text-green-700 items-center justify-center">
  <FileText className="w-5 h-5" />
</span>
            <span className="text-slate-900 font-medium">Gerar Atestado</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>

        {/* Ver Relatórios */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("reports:open"))}
          className="w-full px-4 py-4 flex items-center justify-between rounded-xl border border-slate-100 bg-white hover:bg-slate-50 text-left transition"
        >
          <span className="flex items-center gap-3">
           <span className="inline-flex w-9 h-9 rounded-xl bg-amber-100 text-amber-700 items-center justify-center">
  <BarChart3 className="w-5 h-5" />
</span>
            <span className="text-slate-900 font-medium">Ver Relatórios</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>
      </div>
    </Surface>
  </div>
</div>


      {/* Consultas de Hoje (bloco de tabela que você já tem) */}
      <ConsultasDeHoje onGotoSchedule={onGotoSchedule} />

      {/* Próximos Atendimentos */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Próximos Atendimentos</h2>
        <div className="space-y-3">
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((slot) => {
              const formattedDate = new Date(`${slot.date}T12:00:00`).toLocaleDateString(
                "pt-BR",
                { day: "numeric", month: "short" }
              );
              return (
                <div
                  key={slot.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-slate-900 leading-tight truncate">
                        {slot.patientName || "Paciente não definido"}
                      </h3>
                      <p className="text-slate-600 text-sm truncate">{slot.service}</p>
                      <p className="text-blue-700 text-sm font-medium">
                        {formattedDate} • {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span
                        className={`whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium ${
                          (slot.status || "").toLowerCase() === "agendado"
                            ? "bg-blue-100 text-blue-700"
                            : (slot.status || "").toLowerCase() === "em_andamento"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {(slot.status || "").toLowerCase() === "agendado"
                          ? "Agendado"
                          : "Em Andamento"}
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
    </Page>
  );
};

export default Dashboard;
