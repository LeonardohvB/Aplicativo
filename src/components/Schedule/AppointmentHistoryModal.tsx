import React, { useState } from 'react';
import { X, Search, Calendar, User, Clock, DollarSign } from 'lucide-react';
import { useAppointmentHistory } from '../../hooks/useAppointmentHistory';

interface AppointmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AppointmentHistoryModal: React.FC<AppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { history, loading, getHistoryStats } = useAppointmentHistory();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const stats = getHistoryStats();

  const calculateDuration = (item: any): string => {
    // Se tem timestamps de início e fim, calcula a partir deles
    if (item.startedAt && item.finishedAt) {
      const startTime = new Date(item.startedAt);
      const endTime = new Date(item.finishedAt);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      if (durationMinutes < 60) {
        return `${durationMinutes} min`;
      } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
      }
    }
    
    // Se tem duração real rastreada, usa ela
    if (item.actualDuration && item.actualDuration > 0) {
      const durationMinutes = item.actualDuration;
      
      if (durationMinutes < 60) {
        return `${durationMinutes} min`;
      } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
      }
    }
    
    // Se não tem dados de tempo real, retorna indicação
    return 'Não rastreado';
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.service.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Histórico de Atendimentos</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estatísticas */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalAppointments}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completedAppointments}</p>
              <p className="text-sm text-gray-600">Concluídos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.cancelledAppointments}</p>
              <p className="text-sm text-gray-600">Cancelados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.noShowAppointments}</p>
              <p className="text-sm text-gray-600">Faltaram</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por paciente, profissional ou serviço..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div className="p-6 text-center text-gray-600">
              Carregando histórico...
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nenhum atendimento encontrado com os filtros aplicados.'
                : 'Nenhum atendimento no histórico ainda.'
              }
            </div>
          ) : (
            <div className="divide-y divide-gray-200 pb-32">
              {filteredHistory.map((item) => {
                const formattedDate = new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                const completedDate = new Date(item.completedAt).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={item.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <h3 className="font-semibold text-gray-900">{item.patientName}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <Calendar className="w-4 h-4" />
                              <span>Data: {formattedDate}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>Horário: {item.startTime} - {item.endTime}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                Duração: {calculateDuration(item)} 
                                {(item.startedAt && item.finishedAt) || (item.actualDuration && item.actualDuration > 0) ? (
                                  <span className="text-green-600 font-medium"> ⏱️ (rastreado)</span>
                                ) : (
                                  <span className="text-orange-500 font-medium"> ⚠️ (não rastreado)</span>
                                )}
                              </span>
                            </div>
                            {item.patientPhone && (
                              <div>
                                <span>Telefone: {item.patientPhone}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1">
                            <div>
                              <span className="font-medium">Profissional:</span> {item.professionalName}
                            </div>
                            <div>
                              <span className="font-medium">Serviço:</span> {item.service}
                            </div>
                            <div className="flex items-center space-x-2">
                              <DollarSign className="w-4 h-4" />
                              <span>Valor: R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Finalizado em: {completedDate}
                            </div>
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

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Total de registros: {filteredHistory.length}</span>
            <span>Taxa de conclusão: {stats.completionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentHistoryModal;