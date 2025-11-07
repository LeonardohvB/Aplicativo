// src/components/Dashboard/AppointmentHistoryModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Calendar as CalIcon,
  User,
  Clock,
  DollarSign,
  CalendarDays,
  CalendarRange,
  Filter as FilterIcon,
} from 'lucide-react';
import { useAppointmentHistory } from '../../hooks/useAppointmentHistory';

interface AppointmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/* =================== Helpers de data =================== */
type RangeMode = 'day' | 'week' | 'month' | 'custom';

const toLocalISODate = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const todayLocalISO = () => toLocalISODate(new Date());

/* =================== Helpers de status =================== */
const isDone = (s?: string) => (s ?? '').toLowerCase() === 'concluido';
const isCanceled = (s?: string) => (s ?? '').toLowerCase() === 'cancelado';
const isNoShow = (s?: string) => (s ?? '').toLowerCase() === 'no_show';

const currency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* =================== Data utils (LOCAL-DATE) =================== */
function toLocalYMD(input?: string | Date | null): string {
  if (!input) return '';
  try {
    const s = String(input);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

const AppointmentHistoryModal: React.FC<AppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { history, loading } = useAppointmentHistory();

  // ===== Filtros =====
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [rangeMode, setRangeMode] = useState<RangeMode>('day');
  const [from, setFrom] = useState(todayLocalISO());
  const [to, setTo] = useState(todayLocalISO());

  useEffect(() => {
    if (rangeMode === 'custom') return;

    const now = new Date();
    if (rangeMode === 'day') {
      const d = todayLocalISO();
      setFrom(d);
      setTo(d);
      return;
    }
    if (rangeMode === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay()); // dom-sáb
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setFrom(toLocalISODate(start));
      setTo(toLocalISODate(end));
      return;
    }
    if (rangeMode === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(toLocalISODate(start));
      setTo(toLocalISODate(end));
      return;
    }
  }, [rangeMode]);

  // ===== Data do EVENTO (sempre local) =====
  const eventDateYMD = (it: any) => {
    const s = (it?.status ?? '').toLowerCase();
    const raw =
      (s === 'concluido' ? (it?.finishedAt || it?.completedAt) :
       s === 'cancelado' ? it?.canceledAt :
       s === 'no_show'   ? it?.noShowAt   :
       it?.startedAt) || it?.date;
    return toLocalYMD(raw);
  };

  // ===== Pipeline =====
  const byPeriod = useMemo(
    () =>
      history.filter((it: any) => {
        const d = eventDateYMD(it);
        return (d ?? '') >= from && (d ?? '') <= to;
      }),
    [history, from, to]
  );

  const byStatus = useMemo(() => {
    if (statusFilter === 'all') return byPeriod;
    const wanted = statusFilter.toLowerCase();
    return byPeriod.filter((it: any) => (it.status ?? '').toLowerCase() === wanted);
  }, [byPeriod, statusFilter]);

  const filteredHistory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((item: any) => {
      const p = (item.patientName ?? '').toLowerCase();
      const prof = (item.professionalName ?? '').toLowerCase();
      const svc = (item.service ?? '').toLowerCase();
      return p.includes(q) || prof.includes(q) || svc.includes(q);
    });
  }, [byStatus, searchTerm]);

  // ===== Contadores =====
  const totalAppointments = byPeriod.length;
  const completedAppointments = byPeriod.filter((i) => isDone(i.status)).length;
  const cancelledAppointments = byPeriod.filter((i) => isCanceled(i.status)).length;
  const noShowAppointments = byPeriod.filter((i) => isNoShow(i.status)).length;

  const completionRate =
    totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-2 md:p-4">
      <div
        className="
          relative bg-white rounded-2xl shadow-xl w-full
          max-w-5xl
          h-[92vh] md:h-[90vh]
          overflow-hidden
          pb-[env(safe-area-inset-bottom)]
        "
      >
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Histórico de Atendimentos
            </h2>
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="h-[calc(92vh-64px)] md:h-[calc(90vh-64px)] overflow-y-auto">
          {/* Estatísticas rápidas */}
          <div className="px-5 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-semibold text-gray-800">{totalAppointments}</div>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <div className="text-xs text-green-600">Concluídos</div>
              <div className="text-lg font-semibold text-green-800">{completedAppointments}</div>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <div className="text-xs text-red-600">Cancelados</div>
              <div className="text-lg font-semibold text-red-800">{cancelledAppointments}</div>
            </div>
            <div className="rounded-xl bg-orange-50 p-3">
              <div className="text-xs text-orange-600">Faltaram</div>
              <div className="text-lg font-semibold text-orange-800">{noShowAppointments}</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="px-5 py-4 space-y-3">
            {/* Presets + botão-ícone “Personalizado” */}
            <div className="flex flex-wrap items-center gap-2">
              {(['day', 'week', 'month'] as RangeMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    rangeMode === mode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'text-gray-700 bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setRangeMode(mode)}
                >
                  {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                </button>
              ))}

              {/* Ícone (Personalizado) */}
              <button
                type="button"
                aria-label="Período personalizado"
                title="Período personalizado"
                onClick={() => setRangeMode(rangeMode === 'custom' ? 'day' : 'custom')}
                className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border transition
                  ${
                    rangeMode === 'custom'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Datas e Status (campos só aparecem quando personalizado) */}
            <div className={`grid gap-3 ${rangeMode === 'custom' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-1'}`}>
              {rangeMode === 'custom' && (
                <>
                  <div>
                    <label className="text-xs text-gray-500">De</label>
                    <div className="relative">
                      <CalIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={from}
                        onChange={(e) => {
                          setFrom(e.target.value);
                          setRangeMode('custom');
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Até</label>
                    <div className="relative">
                      <CalIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={to}
                        onChange={(e) => {
                          setTo(e.target.value);
                          setRangeMode('custom');
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-gray-500">Status</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos os Status</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                  <option value="no_show">Faltou</option>
                </select>
              </div>
            </div>

            {/* Busca */}
            <div>
              <label className="text-xs text-gray-500">Buscar por paciente, profissional ou serviço</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="px-5 pb-5">
            {loading ? (
              <div className="text-sm text-gray-500">Carregando histórico...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum registro no período.</div>
            ) : (
              <ul className="space-y-3">
                {filteredHistory.map((item: any) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'concluido':
                        return 'bg-green-100 text-green-700';
                      case 'cancelado':
                        return 'bg-red-100 text-red-700';
                      case 'no_show':
                        return 'bg-orange-100 text-orange-700';
                      default:
                        return 'bg-gray-100 text-gray-700';
                    }
                  };
                  const getStatusText = (status: string) => {
                    switch (status) {
                      case 'concluido':
                        return 'Concluído';
                      case 'cancelado':
                        return 'Cancelado';
                      case 'no_show':
                        return 'Faltou';
                      default:
                        return status;
                    }
                  };

                  const calculateDuration = (it: any): string => {
                    if (it.startedAt && it.finishedAt) {
                      const startTime = new Date(it.startedAt);
                      const endTime = new Date(it.finishedAt);
                      const durationMinutes = Math.round(
                        (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                      );
                      if (durationMinutes < 60) return `${durationMinutes} min`;
                      const hours = Math.floor(durationMinutes / 60);
                      const minutes = durationMinutes % 60;
                      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
                    }
                    if (it.actualDuration && it.actualDuration > 0) {
                      const durationMinutes = it.actualDuration;
                      if (durationMinutes < 60) return `${durationMinutes} min`;
                      const hours = Math.floor(durationMinutes / 60);
                      const minutes = durationMinutes % 60;
                      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
                    }
                    return 'Não rastreado';
                  };

                  return (
                    <li key={item.id} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(() => {
                              const d = eventDateYMD(item);
                              const [y, m, day] = d.split('-').map(Number);
                              if (!y || !m || !day) return d || '—';
                              const dt = new Date(y, m - 1, day);
                              return dt.toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              });
                            })()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: <span className="font-mono">{item.id}</span>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-800">
                              {item.patientName ?? '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CalendarDays className="w-4 h-4 text-gray-400" />
                            <span>
                              Data:{' '}
                              {item.date
                                ? (() => {
                                    const [y, m, d] = String(item.date).split('-').map(Number);
                                    if (!y || !m || !d) return item.date;
                                    const dt = new Date(y, m - 1, d);
                                    return dt.toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric',
                                    });
                                  })()
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>
                              Horário:{' '}
                              {item.startTime && item.endTime
                                ? `${item.startTime} - ${item.endTime}`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span>
                              Duração: {calculateDuration(item)}{' '}
                              {!item.startedAt && !item.finishedAt && !item.actualDuration ? (
                                <span className="text-orange-600">(não rastreado)</span>
                              ) : null}
                            </span>
                          </div>
                          {item.patientPhone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User className="w-4 h-4 text-gray-400" />
                              <span>Telefone: {item.patientPhone}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-800">
                              <span className="text-gray-500">Profissional:</span>{' '}
                              {item.professionalName ?? '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarRange className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-800">
                              <span className="text-gray-500">Serviço:</span>{' '}
                              {item.service ?? '—'}{' '}
                              {item.billingMode === 'clinica' ? '(clínica)' :
                               item.billingMode === 'profissional' ? '(profissional)' : ''}
                              {item.isRemote ? ' (online)' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-800">
                              <span className="text-gray-500">Valor:</span>{' '}
                              {typeof item.price === 'number' ? currency(item.price) : '—'}
                            </span>
                          </div>

                          {(item.finishedAt || item.completedAt) && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <CalendarDays className="w-4 h-4 text-gray-400" />
                              <span>
                                Finalizado em:{' '}
                                {(() => {
                                  const ts = item.finishedAt || item.completedAt;
                                  try {
                                    const dt = new Date(ts);
                                    return dt.toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return String(ts);
                                  }
                                })()}
                              </span>
                            </div>
                          )}

                          {item.canceledAt && (
                            <div className="flex items-center gap-2 text-xs text-red-600">
                              <CalendarDays className="w-4 h-4" />
                              <span>
                                Cancelado em:{' '}
                                {(() => {
                                  try {
                                    const dt = new Date(item.canceledAt);
                                    return dt.toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return String(item.canceledAt);
                                  }
                                })()}
                              </span>
                            </div>
                          )}

                          {item.noShowAt && (
                            <div className="flex items-center gap-2 text-xs text-orange-600">
                              <CalendarDays className="w-4 h-4" />
                              <span>
                                Marcado como falta em:{' '}
                                {(() => {
                                  try {
                                    const dt = new Date(item.noShowAt);
                                    return dt.toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                  } catch {
                                    return String(item.noShowAt);
                                  }
                                })()}
                              </span>
                            </div>
                          )}
                        </div>

                        {item.notes && (
                          <div className="md:col-span-2">
                            <div className="mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700">
                              <div className="flex items-center gap-2 mb-1">
                                <FilterIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-500">Observações</span>
                              </div>
                              <div className="whitespace-pre-wrap">{item.notes}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Rodapé */}
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 sticky bottom-0">
            <div className="flex justify-between items-center text-xs md:text-sm text-gray-600">
              <span>Total de registros exibidos: {filteredHistory.length}</span>
              <span>Taxa de conclusão (no período): {completionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentHistoryModal;
