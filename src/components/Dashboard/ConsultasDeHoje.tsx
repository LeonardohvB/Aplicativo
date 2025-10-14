// src/components/Dashboard/ConsultasDeHoje.tsx
import React, { useMemo } from "react";
import { useAppointmentJourneys } from "../../hooks/useAppointmentJourneys";
import { useAppointmentHistory } from "../../hooks/useAppointmentHistory";
import { useProfessionals } from "../../hooks/useProfessionals";

type Props = {
  onGotoSchedule?: (filter: "today" | "week") => void;
};

function statusFromHistory(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "concluido" || v === "concluído" || v === "finalizado") return "confirmada";
  if (v === "cancelado") return "cancelada";
  if (v === "no_show") return "falta";
  return v || "pendente";
}
function statusFromSlot(s?: string) {
  const v = (s || "").toLowerCase();
  if (v === "em_andamento" || v === "finalizado") return "confirmada";
  if (v === "agendado") return "pendente";
  if (v === "cancelado") return "cancelada";
  if (v === "no_show") return "falta";
  return v || "pendente";
}
function isTodayLocal(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`); // fixa meio-dia para evitar TZ
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const ConsultasDeHoje: React.FC<Props> = ({ onGotoSchedule }) => {
  const { slots } = useAppointmentJourneys();
  const { history } = useAppointmentHistory();
  const { professionals } = useProfessionals();

  // índice: cruza com histórico por (date|start|patientId|professionalId)
  const historyIndex = useMemo(() => {
    const idx = new Map<string, any>();
    (history || []).forEach((h: any) => {
      const key = `${h.date}|${h.startTime}|${h.patientId ?? ""}|${h.professionalId ?? ""}`;
      idx.set(key, h);
    });
    return idx;
  }, [history]);

  // índice de profissionais por id
  const proIndex = useMemo(() => {
    const idx = new Map<string, any>();
    (professionals || []).forEach((p: any) => idx.set(p.id, p));
    return idx;
  }, [professionals]);

  const rows = useMemo(() => {
    // todos os slots de hoje (com ou sem paciente)
    const todays = (slots || []).filter((s: any) => isTodayLocal(s.date));

    const merged = todays.map((s: any) => {
      const key = `${s.date}|${s.startTime}|${s.patientId ?? ""}|${s.professionalId ?? ""}`;
      const h = historyIndex.get(key);
      const pro = s.professionalId ? proIndex.get(s.professionalId) : null;

      const hasPatient = Boolean(s.patientId) || Boolean(s.patientName);

      // status: se não tem paciente => VAGO; senão prioriza histórico → slot
      let status: string;
      if (!hasPatient) {
        status = "vago";
      } else {
        status = h?.status ? statusFromHistory(h.status) : statusFromSlot(s.status);
      }

      const professionalName =
        s.professionalName ?? h?.professionalName ?? pro?.name ?? "—";

      const specialty =
        (pro?.specialty && String(pro.specialty)) ||
        (h?.service && String(h.service)) ||
        (s?.service && String(s.service)) ||
        "—";

      return {
        id: s.id,
        patientName: hasPatient ? (s.patientName ?? h?.patientName ?? "—") : "—",
        professionalName,
        specialty,
        startTime: s.startTime || "--:--",
        status,
      };
    });

    merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return merged;
  }, [slots, historyIndex, proIndex]);

  // contagens (não contam VAGO)
  const confirmed = rows.filter((r) => r.status === "confirmada").length;
  const pending   = rows.filter((r) => r.status === "pendente").length;

  // badge de status com ícone à esquerda (compacto e sem quebra)
  const renderBadge = (status: string) => {
    const base =
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap " +
      "rounded-full border px-2.5 py-1 " +
      "text-[11.5px] sm:text-xs font-medium leading-none";

    const IconCheck = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
        <path fill="currentColor" d="M9.55 17.05L5.4 12.9l1.4-1.4l2.75 2.75L17.2 6.6l1.4 1.4z"/>
      </svg>
    );
    const IconClock = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
        <path fill="currentColor" d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4t5.675 2.325T20 12t-2.325 5.675T12 20m0-2q2.5 0 4.25-1.75T18 12t-1.75-4.25T12 6T7.75 7.75T6 12t1.75 4.25T12 18m1-4l3.5 2l.75-1.23L13 12V7h-1v6z"/>
      </svg>
    );
    const IconX = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
        <path fill="currentColor" d="m12 13.4l4.6 4.6l1.4-1.4L13.4 12l4.6-4.6l-1.4-1.4L12 10.6L7.4 6L6 7.4L10.6 12L6 16.6L7.4 18z"/>
      </svg>
    );
    const IconDash = () => (
      <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
        <path fill="currentColor" d="M5 12h14v2H5z" />
      </svg>
    );

    if (status === "confirmada") {
      return (
        <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
          <IconCheck /> Confirmada
        </span>
      );
    }
    if (status === "pendente") {
      return (
        <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
          <IconClock /> Pendente
        </span>
      );
    }
    if (status === "cancelada") {
      return (
        <span className={`${base} bg-rose-50 text-rose-700 border-rose-200`}>
          <IconX /> Cancelada
        </span>
      );
    }
    if (status === "vago") {
      return (
        <span className={`${base} bg-slate-50 text-blue-600 border-blue-200`}>
          <IconDash /> Vago
        </span>
      );
    }
    // falta / no_show e demais
    return (
      <span className={`${base} bg-slate-100 text-slate-700 border-slate-200`}>
        <IconDash /> Falta
      </span>
    );
  };

  return (
    <div className="mt-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Consultas de Hoje</h2>
            <p className="text-slate-500 text-sm">
              <span className="font-medium">{confirmed}</span> confirmadas ·{" "}
              <span className="font-medium">{pending}</span> pendentes
            </p>
          </div>
          <button
            onClick={() => onGotoSchedule?.("today")}
            className="text-blue-700 text-sm font-medium hover:underline inline-flex items-center gap-1"
          >
            Ver agenda completa <span aria-hidden>›</span>
          </button>
        </div>

        <div className="px-2 pb-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-y border-slate-100">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Especialidade</th>
                  <th className="px-4 py-3 font-medium">Profissional</th>
                  <th className="px-4 py-3 font-medium">Horário</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      Nenhuma consulta para hoje
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onGotoSchedule?.("today")}
                          className="text-slate-900 font-medium hover:underline"
                        >
                          {s.patientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.specialty}</td>
                      <td className="px-4 py-3 text-slate-700">{s.professionalName}</td>
                      <td className="px-4 py-3 text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-60">
                            <path
                              fill="currentColor"
                              d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4t5.675 2.325T20 12t-2.325 5.675T12 20m0-2q2.5 0 4.25-1.75T18 12t-1.75-4.25T12 6T7.75 7.75T6 12t1.75 4.25T12 18m1-4l3.5 2l.75-1.23L13 12V7h-1v6z"
                            />
                          </svg>
                          <span className="font-semibold">{s.startTime}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="min-w-[112px]">{renderBadge(s.status)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onGotoSchedule?.("today")}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100"
                          aria-label="Ver"
                          title="Ver"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M9 18l6-6l-6-6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsultasDeHoje;
