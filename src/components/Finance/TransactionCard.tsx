import React from 'react';
import { Edit2, Trash2, TrendingUp, TrendingDown, Calendar, Tag } from 'lucide-react';
import { Transaction } from '../../types';

interface TransactionCardProps {
  transaction: Transaction;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
}) => {
  const isIncome = transaction.type === 'income';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          <div className={`p-3 rounded-2xl ${isIncome ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
            {isIncome ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div>
              {transaction.description.includes('\n') ? (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 break-words">
                    {transaction.description.split('\n')[0]}
                  </h4>
                  <p className="text-xs sm:text-sm text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-lg inline-block break-words">
                    {transaction.description.split('\n')[1]}
                  </p>
                </div>
              ) : (
                <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 break-words">{transaction.description}</h4>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mt-2 gap-1 sm:gap-0">
              <div className="flex items-center space-x-1">
                <Tag className="w-3 h-3 text-gray-400" />
                <span className="text-gray-600 text-xs sm:text-sm">{transaction.category}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                <span className="text-gray-500 text-xs sm:text-sm">{transaction.date}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start sm:space-y-3 space-x-3 sm:space-x-0">
          <div className="text-right">
            <span className={`font-bold text-base sm:text-lg ${isIncome ? 'text-green-600' : 'text-red-600'} break-all`}>
              {isIncome ? '+' : '-'} R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className={`text-xs font-medium mt-1 ${isIncome ? 'text-green-500' : 'text-red-500'} whitespace-nowrap`}>
              {isIncome ? 'Receita' : 'Despesa'}
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(transaction.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110 flex-shrink-0"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(transaction.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;