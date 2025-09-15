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

const AppointmentHistoryModal: React.FC<AppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { history, loading } = useAppointmentHistory();

  // ===== Filtros existentes =====
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ===== Novo: filtro de período =====
  const [rangeMode, setRangeMode] = useState<RangeMode>('day');
  const [from, setFrom] = useState(todayLocalISO());
  const [to, setTo] = useState(todayLocalISO());

  // define from/to automaticamente quando não for "custom"
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
      // semana local domingo–sábado (ajuste se preferir segunda–domingo)
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
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

  // ===== Pipeline de filtros =====
  // 1) período
  const byPeriod = useMemo(
    () => history.filter((it: any) => (it.date ?? '') >= from && (it.date ?? '') <= to),
    [history, from, to]
  );

  // 2) status
  const byStatus = useMemo(() => {
    if (statusFilter === 'all') return byPeriod;
    const wanted = statusFilter.toLowerCase();
    return byPeriod.filter((it: any) => (it.status ?? '').toLowerCase() === wanted);
  }, [byPeriod, statusFilter]);

  // 3) busca
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

  // ===== Contadores (APENAS período) =====
  const totalAppointments = byPeriod.length;
  const completedAppointments = byPeriod.filter((i) => isDone(i.status)).length;
  const cancelledAppointments = byPeriod.filter((i) => isCanceled(i.status)).length;
  const noShowAppointments = byPeriod.filter((i) => isNoShow(i.status)).length;

  const completionRate =
    totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;

  const calculateDuration = (item: any): string => {
    // 1) duração via startedAt/finishedAt
    if (item.startedAt && item.finishedAt) {
      const startTime = new Date(item.startedAt);
      const endTime = new Date(item.finishedAt);
      const durationMinutes = Math.round(
        (endTime.getTime() - startTime.getTime()) / (1000 * 60)
      );

      if (durationMinutes < 60) return `${durationMinutes} min`;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }

    // 2) duração rastreada manualmente (actualDuration)
    if (item.actualDuration && item.actualDuration > 0) {
      const durationMinutes = item.actualDuration;
      if (durationMinutes < 60) return `${durationMinutes} min`;
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
    }

    // 3) sem dados
    return 'Não rastreado';
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Histórico de Atendimentos</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estatísticas (apenas do período) */}
        <div className="p-5 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xl font-bold text-blue-600">{totalAppointments}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{completedAppointments}</p>
              <p className="text-xs text-gray-600">Concluídos</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-600">{cancelledAppointments}</p>
              <p className="text-xs text-gray-600">Cancelados</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-orange-600">{noShowAppointments}</p>
              <p className="text-xs text-gray-600">Faltaram</p>
            </div>
          </div>
        </div>

        {/* Filtros: período + busca + status */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex flex-col gap-3">
            {/* Botões de período */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setRangeMode('day')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${
                  rangeMode === 'day'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
                title="Hoje"
              >
                <CalendarDays size={14} /> Dia
              </button>
              <button
                onClick={() => setRangeMode('week')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${
                  rangeMode === 'week'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
                title="Semana"
              >
                <CalendarRange size={14} /> Semana
              </button>
              <button
                onClick={() => setRangeMode('month')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${
                  rangeMode === 'month'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
                title="Mês"
              >
                <CalIcon size={14} /> Mês
              </button>
              <button
                onClick={() => setRangeMode('custom')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${
                  rangeMode === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
                title="Personalizado"
              >
                <FilterIcon size={14} /> Personalizado
              </button>
            </div>

            {/* Datas quando for personalizado */}
            {rangeMode === 'custom' && (
              <div className="flex items-end gap-2">
                <div className="flex flex-col min-w-[150px]">
                  <span className="text-xs text-gray-500 mb-1">Data inicial</span>
                  <div className="relative">
                    <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="w-full pr-2.5 pl-8 py-1.5 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col min-w-[150px]">
                  <span className="text-xs text-gray-500 mb-1">Data final</span>
                  <div className="relative">
                    <CalIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="w-full pr-2.5 pl-8 py-1.5 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Busca + Status */}
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, profissional ou serviço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="all">Todos os Status</option>
                <option value="concluido">Concluídos</option>
                <option value="cancelado">Cancelados</option>
                <option value="no_show">Faltaram</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Histórico */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Carregando histórico...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {searchTerm || statusFilter !== 'all'
                ? 'Nenhum atendimento encontrado com os filtros aplicados.'
                : 'Nenhum atendimento no período.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 pb-32">
              {filteredHistory.map((item: any) => {
                const formattedDate = new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                const completedDate =
                  item.completedAt
                    ? new Date(item.completedAt).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : undefined;

                return (
                  <div key={item.id} className="p-5 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <h3 className="font-semibold text-gray-900">{item.patientName}</h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}
                          >
                            {getStatusText(item.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CalIcon className="w-4 h-4" />
                              <span>Data: {formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                Horário: {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                Duração: {calculateDuration(item)}{' '}
                                {(item.startedAt && item.finishedAt) ||
                                (item.actualDuration && item.actualDuration > 0) ? (
                                  <span className="text-green-600 font-medium"> ⏱️ (rastreado)</span>
                                ) : (
                                  <span className="text-orange-500 font-medium"> ⚠️ (não rastreado)</span>
                                )}
                              </span>
                            </div>
                            {item.patientPhone && <div>Telefone: {item.patientPhone}</div>}
                          </div>

                          <div className="space-y-1">
                            <div>
                              <span className="font-medium">Profissional:</span> {item.professionalName}
                            </div>
                            <div>
                              <span className="font-medium">Serviço:</span> {item.service}
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4" />
                              <span>
                                Valor:{' '}
                                {currency(Number(item.price ?? 0))}
                              </span>
                            </div>
                            {completedDate && (
                              <div className="text-xs text-gray-500">Finalizado em: {completedDate}</div>
                            )}
                          </div>
                        </div>

                        {item.notes && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Observações:</span> {item.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-5 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-xs md:text-sm text-gray-600">
            <span>Total de registros exibidos: {filteredHistory.length}</span>
            <span>Taxa de conclusão (no período): {completionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentHistoryModal;
