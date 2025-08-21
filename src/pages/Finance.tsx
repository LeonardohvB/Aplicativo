import React, { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Eye, EyeOff, Wallet, CreditCard } from 'lucide-react';
import TransactionCard from '../components/Finance/TransactionCard';
import AddTransactionModal from '../components/Finance/AddTransactionModal';
import { useTransactions } from '../hooks/useTransactions';

const Finance: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const { transactions, loading, addTransaction, deleteTransaction } = useTransactions();

  const totalRevenue = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalRevenue - totalExpenses;

  const handleEdit = (id: string) => {
    console.log('Edit transaction:', id);
  };

  const handleAdd = async (newTransaction: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
  }) => {
    await addTransaction(newTransaction);
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando transações...</div>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      {/* Header com gradiente */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 pt-8 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Financeiro</h1>
            <p className="text-blue-100 text-sm mt-1">Gerencie suas finanças</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="p-3 bg-white/20 backdrop-blur-sm text-white rounded-2xl hover:bg-white/30 transition-all duration-300 shadow-lg hover:shadow-xl flex-shrink-0"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Card de Saldo Principal */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/90 font-medium text-sm sm:text-base">Saldo Total</span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors flex-shrink-0"
            >
              {showBalance ? (
                <Eye className="w-4 h-4 text-white" />
              ) : (
                <EyeOff className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-2xl sm:text-4xl font-bold text-white mb-2 break-all">
              {showBalance ? `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
            </p>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              balance >= 0 
                ? 'bg-green-500/20 text-green-100' 
                : 'bg-red-500/20 text-red-100'
            }`}>
              {balance >= 0 ? '↗ Positivo' : '↘ Negativo'}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Receitas e Despesas */}
      <div className="px-6 -mt-8 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Card Receitas */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-2 mb-3">
              <div className="p-2 bg-green-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Receitas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
              {showBalance ? `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
            </p>
            <div className="flex items-center mt-2">
              <div className="w-full bg-green-100 rounded-full h-1.5">
                <div 
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: totalRevenue > 0 ? '100%' : '0%' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card Despesas */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-2 mb-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Despesas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-600 break-all">
              {showBalance ? `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
            </p>
            <div className="flex items-center mt-2">
              <div className="w-full bg-red-100 rounded-full h-1.5">
                <div 
                  className="bg-red-500 h-1.5 rounded-full transition-all duration-500" 
                  style={{ width: totalExpenses > 0 ? '100%' : '0%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Transações */}
      <div className="px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <h2 className="text-xl font-bold text-gray-900">Transações Recentes</h2>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <span className="text-xs sm:text-sm text-gray-500">{transactions.length} transações</span>
          </div>
        </div>
        
        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100/50 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma transação ainda</h3>
            <p className="text-gray-500 mb-4">Adicione sua primeira transação para começar</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Adicionar Transação
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-32">
            {transactions.map((transaction) => (
              <TransactionCard
                key={transaction.id}
                transaction={transaction}
                onEdit={handleEdit}
                onDelete={deleteTransaction}
              />
            ))}
          </div>
        )}
      </div>

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default Finance;