import React from 'react';
import {
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  Tag,
  User,
  ChevronDown,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { Transaction, TxStatus } from '../../types';

interface TransactionCardProps {
  transaction: Transaction & {
    status?: TxStatus | null;
    paymentMethod?: string | null;
    professionalName?: string | null;
    patientName?: string | null;
    service?: string | null;
    paidAt?: string | null;
    // vindo do histórico (se existir)
    startedAt?: string | null;
    finishedAt?: string | null;
    actualDuration?: number | null;
    notes?: string | null;
  };
  /** Tornados opcionais para esconder as ações da frente do card */
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Ações rápidas de status (opcional) — usadas só em RECEITAS */
  onUpdateStatus?: (id: string, next: TxStatus) => void;
  /** Visual: rotaciona o chevron quando o wrapper abrir */
  isOpen?: boolean;
  /** quando false, não renderiza a moldura externa (usado no Finance) */
  wrap?: boolean;
}

function StatusBadge({ status }: { status?: TxStatus | null }) {
  if (status === 'paid') {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Pago
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
        <Clock3 className="h-3.5 w-3.5" />
        Pendente
      </span>
    );
  }
  return null;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  onUpdateStatus,
  isOpen = false,
  wrap = true,
}) => {
  const isIncome = transaction.type === 'income';

  // título
  const professional = transaction.professionalName ?? undefined;
  const patient = transaction.patientName ?? undefined;
  const title =
    professional
      ? `Atendimento - ${professional}`
      : transaction.description?.split('\n')[0] || transaction.description || 'Transação';

  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

  // cor do valor: só âmbar quando RECEITA pendente
  const amountClass = isIncome
    ? transaction.status === 'pending'
      ? 'text-amber-600'
      : 'text-green-600'
    : 'text-red-600';

  // ------- CONTEÚDO INTERNO (sem moldura) -------
  const header = (
    <div className="flex flex-col gap-3">
      {/* Linha 1 — título + chevron */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-3 rounded-2xl ${
              isIncome ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
            }`}
          >
            {isIncome ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm sm:text-base break-words">
              {title}
            </h4>

            {patient && (
              <span className="mt-1 inline-flex items-center text-xs sm:text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded-lg font-medium">
                <User className="w-3 h-3 mr-1" />
                {patient}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        />
      </div>

      {/* Linha 2 — categoria  |  editar/excluir à direita (sem data aqui!) */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
            <Tag className="w-3.5 h-3.5 text-gray-400" />
            <span>{(transaction as any).service ?? (transaction as any).category}</span>
          </div>
        </div>

        {onEdit && onDelete && (
          <div className="flex items-center gap-2">
            <button
              onMouseDown={stop}
              onClick={(e) => {
                stop(e);
                onEdit(transaction.id);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110"
              title="Editar"
              aria-label="Editar transação"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onMouseDown={stop}
              onClick={(e) => {
                stop(e);
                onDelete(transaction.id);
              }}
              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110"
              title="Excluir"
              aria-label="Excluir transação"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Linha 3 — valor + (badge de status apenas para RECEITAS) + ações */}
      <div className="flex items-center justify-between">
        <div className="text-left">
          <span className={`font-bold text-base sm:text-lg ${amountClass} whitespace-nowrap tabular-nums`}>
            {isIncome ? '+' : '-'} R{'$ '}
            {transaction.amount.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>

          {/* Badge somente para RECEITAS com status definido */}
          {isIncome && transaction.status && <StatusBadge status={transaction.status} />}
        </div>

        {/* Ações de pagamento somente para RECEITAS */}
        {isIncome && onUpdateStatus && (
          <div className="flex items-center gap-2">
            {transaction.status === 'pending' ? (
              <button
                onMouseDown={stop}
                onClick={(e) => {
                  stop(e);
                  onUpdateStatus(transaction.id, 'paid');
                }}
                className="px-3 py-1 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                Pagar
              </button>
            ) : (
              <button
                onMouseDown={stop}
                onClick={(e) => {
                  stop(e);
                  onUpdateStatus(transaction.id, 'pending');
                }}
                className="px-3 py-1 text-xs rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
              >
                Estornar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ------- WRAP opcional -------
  if (wrap) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300">
        {header}
      </div>
    );
  }

  // sem moldura (usado no Finance para juntar com os detalhes)
  return header;
};

export default TransactionCard;
