import React from 'react';
import { Clock, User, Play, Square, CheckCircle, XCircle, AlertCircle, Edit, Timer } from 'lucide-react';
import { AppointmentSlot } from '../../types';

interface SlotCardProps {
  slot: AppointmentSlot;
  onSchedulePatient: (slotId: string) => void;
  onEditPatient: (slotId: string) => void;
  onStartAppointment: (slotId: string) => void;
  onFinishAppointment: (slotId: string) => void;
  onCancelAppointment: (slotId: string) => void;
  onMarkNoShow: (slotId: string) => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  onSchedulePatient,
  onEditPatient,
  onStartAppointment,
  onFinishAppointment,
  onCancelAppointment,
  onMarkNoShow,
}) => {
  const [elapsedTime, setElapsedTime] = React.useState<string>('');

  // ===== Cronômetro para atendimentos em andamento =====
  React.useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (slot.status === 'em_andamento' && slot.startedAt) {
      interval = setInterval(() => {
        const startTime = new Date(slot.startedAt!);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));

        if (diffMinutes < 60) {
          setElapsedTime(`${diffMinutes} min`);
        } else {
          const hours = Math.floor(diffMinutes / 60);
          const minutes = diffMinutes % 60;
          setElapsedTime(minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`);
        }
      }, 1000);
    } else {
      setElapsedTime('');
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [slot.status, slot.startedAt]);

  // ===== Helpers de data no fuso LOCAL =====
  const todayLocalISO = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const isToday = () => slot.date === todayLocalISO();
  const isFutureDate = () => slot.date > todayLocalISO();
  const isPastDate = () => slot.date < todayLocalISO();

  // Verificar se o horário já passou (apenas para o dia atual)
  const isTimeExpired = () => {
    if (!isToday()) return false;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes()
      .toString()
      .padStart(2, '0')}`;
    return slot.endTime < currentTime;
  };

  // Para "Disponível": passado absoluto (data passada OU hoje com horário já encerrado)
  const isPastAbsolute = isPastDate() || (isToday() && isTimeExpired());

  // ===== Visual =====
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fora_horario':
        return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'disponivel':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      case 'agendado':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'em_andamento':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'concluido':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'cancelado':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'no_show':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fora_horario':
        return <AlertCircle className="w-4 h-4" />;
      case 'disponivel':
        return <Clock className="w-4 h-4" />;
      case 'agendado':
        return <User className="w-4 h-4" />;
      case 'em_andamento':
        return <Play className="w-4 h-4" />;
      case 'concluido':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelado':
        return <XCircle className="w-4 h-4" />;
      case 'no_show':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'fora_horario':
        return 'Fora do horário';
      case 'disponivel':
        return 'Disponível';
      case 'agendado':
        return 'Agendado';
      case 'em_andamento':
        return 'Em Andamento';
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

  // Para a tarja/ícone: se estiver "disponível" mas já passou, tratamos como "fora_horario"
  const visualStatus = slot.status === 'disponivel' && isPastAbsolute ? 'fora_horario' : slot.status;

  return (
    <div className={`rounded-xl p-4 border-2 transition-all hover:shadow-md ${getStatusColor(visualStatus)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {getStatusIcon(visualStatus)}
          <span className="font-medium text-sm">
            {slot.startTime} - {slot.endTime}
          </span>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white bg-opacity-50">
          {getStatusText(visualStatus)}
        </span>
      </div>

      {slot.patientName && (
        <div className="mb-3">
          <p className="font-medium text-gray-900">{slot.patientName}</p>
          {slot.patientPhone && <p className="text-sm text-gray-600">{slot.patientPhone}</p>}
          <p className="text-sm text-gray-600">
            {slot.service} - R${' '}
            {slot.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">
            Modo: {slot.billingMode === 'clinica' ? 'Clínica' : 'Profissional'}
          </p>
          {slot.status === 'em_andamento' && elapsedTime && (
            <div className="flex items-center space-x-1 mt-2 p-2 bg-yellow-50 rounded-lg">
              <Timer className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">Tempo decorrido: {elapsedTime}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex space-x-2">
        {/* DISPONÍVEL */}
        {slot.status === 'disponivel' && (
          <button
            onClick={() => !isPastAbsolute && onSchedulePatient(slot.id)}
            disabled={isPastAbsolute}
            className={
              'flex-1 px-3 py-2 text-sm rounded-lg transition-colors ' +
              (isPastAbsolute
                ? 'bg-gray-300 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700')
            }
          >
            {isPastAbsolute ? 'Fora do horário' : 'Agendar'}
          </button>
        )}

        {/* AGENDADO */}
        {slot.status === 'agendado' && (
          <>
            <button
              onClick={() => onEditPatient(slot.id)}
              className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              title="Editar agendamento"
            >
              <Edit className="w-4 h-4" />
            </button>

            {isToday() && !isTimeExpired() ? (
              <button
                onClick={() => onStartAppointment(slot.id)}
                className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
              >
                Iniciar
              </button>
            ) : isToday() && isTimeExpired() ? (
              <button
                disabled
                className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg cursor-not-allowed"
                title="Horário já passou"
              >
                Expirado
              </button>
            ) : isFutureDate() ? (
              <button
                onClick={() => onEditPatient(slot.id)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                title="Agendamento para data futura - clique para editar"
              >
                Aguardando
              </button>
            ) : (
              <button
                disabled
                className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg cursor-not-allowed"
                title="Data já passou - não é possível iniciar"
              >
                Passado
              </button>
            )}

            <button
              onClick={() => onCancelAppointment(slot.id)}
              className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Cancelar
            </button>
          </>
        )}

        {/* EM ANDAMENTO */}
        {slot.status === 'em_andamento' && (
          <>
            {isToday() ? (
              <>
                <button
                  onClick={() => onFinishAppointment(slot.id)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  title="Finalizar atendimento em andamento"
                >
                  Finalizar
                </button>
                <button
                  onClick={() => onMarkNoShow(slot.id)}
                  className="px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Faltou
                </button>
              </>
            ) : (
              <button
                disabled
                className="flex-1 px-3 py-2 bg-gray-400 text-white text-sm rounded-lg cursor-not-allowed"
                title="Atendimento em andamento - só pode ser finalizado no dia"
              >
                Em Andamento
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SlotCard;
