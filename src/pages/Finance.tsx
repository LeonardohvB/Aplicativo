// src/pages/Finance.tsx
import React, { useState } from 'react';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Wallet,
  CreditCard,
  Calendar,
  Tag,
  User,
  Clock,
} from 'lucide-react';
import TransactionCard from '../components/Finance/TransactionCard';
import AddTransactionModal from '../components/Finance/AddTransactionModal';
import EditTransactionModal from '../components/Finance/EditTransactionModal';
import { useTransactions } from '../hooks/useTransactions';
import { Transaction } from '../types';

type TxStatus = 'pending' | 'paid';

const Finance: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const {
    transactions,
    loading,
    addTransaction,
    deleteTransaction,
    editTransaction,
    updateTxStatus,
  } = useTransactions();

  // -------- helpers de extração/fallback --------
  const extractProfessional = (t: any): string | undefined => {
    if (t?.professionalName) return t.professionalName as string;
    if (t?.professional) return t.professional as string;
    if (typeof t?.description === 'string') {
      const parts = t.description.split('\n');
      if (parts[1]) return parts[1].trim();
    }
    return undefined;
  };

  const extractPatientFromDesc = (desc?: string): string | undefined => {
    if (!desc) return undefined;
    const m = desc.match(/Atendimento\s*-\s*(.+?)\s*\((.+?)\)/i);
    return m?.[1]?.trim();
  };

  const extractService = (t: any): string | undefined => {
    if (t?.service) return String(t.service);
    if (typeof t?.description === 'string') {
      const m = t.description.match(/\(([^)]+)\)\s*$/);
      if (m?.[1]) return m[1].trim();
    }
    if (t?.category) return String(t.category);
    return undefined;
  };

  const extractNotes = (t: any): string | undefined => {
    return (
      t?.notes ??
      t?.observation ??
      t?.observations ??
      t?.appointmentNotes ??
      undefined
    );
  };

  const minutesBetween = (a: Date, b: Date) =>
    Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));

  const extractDurationMin = (t: any): number | undefined => {
    // preferir campos diretos
    if (typeof t?.durationMin === 'number') return t.durationMin;
    if (typeof t?.actualDuration === 'number') return t.actualDuration;

    // tentar calcular com started/finished (camelCase e snake_case)
    const startISO = t?.startedAt ?? t?.started_at ?? null;
    const endISO = t?.finishedAt ?? t?.finished_at ?? null;
    if (startISO && endISO) {
      const start = new Date(startISO);
      const end = new Date(endISO);
      const m = minutesBetween(start, end);
      if (Number.isFinite(m)) return m;
    }
    return undefined;
  };

  // Totais: só contam receitas **pagas**
  const totalRevenue = transactions
    .filter((t: any) => t.type === 'income' && ((t.status ?? 'pending') === 'paid'))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalRevenue - totalExpenses;

  const handleEdit = (id: string) => {
    const t = transactions.find((x) => x.id === id) || null;
    setEditing(t as Transaction | null);
  };

  const handleSaveEdit = async (updates: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
    date: string;
  }) => {
    if (!editing) return;
    await editTransaction(editing.id, updates);
    setEditing(null);
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

  const toggleOpen = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
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
      {/* Header */}
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

        {/* Saldo */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/90 font-medium text-sm sm:text-base">
                Saldo Total
              </span>
            </div>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-colors flex-shrink-0"
              title={showBalance ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showBalance ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-white" />}
            </button>
          </div>

          <div className="text-center">
            <p className="text-2xl sm:text-4xl font-bold text-white mb-2 break-all">
              {showBalance
                ? `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </p>
            <div
              className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                balance >= 0 ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'
              }`}
            >
              {balance >= 0 ? '↗ Positivo' : '↘ Negativo'}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="px-6 mt-10 md:mt-20 lg:mt-24 mb-6 relative z-10">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-2 mb-3">
              <div className="p-2 bg-green-50 rounded-xl">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Receitas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-600 break-all">
              {showBalance
                ? `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </p>
            <div className="flex items-center mt-2">
              <div className="w-full bg-green-100 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: totalRevenue > 0 ? '100%' : '0%' }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100/50 hover:shadow-xl transition-all duration-300">
            <div className="flex items-start space-x-2 mb-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-gray-700 font-medium text-xs sm:text-sm">Despesas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-600 break-all">
              {showBalance
                ? `R$ ${totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '••••••'}
            </p>
            <div className="flex items-center mt-2">
              <div className="w-full bg-red-100 rounded-full h-1.5">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: totalExpenses > 0 ? '100%' : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transações */}
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
            {transactions.map((t: any) => {
              const prof = extractProfessional(t);
              const patient = t.patientName ?? extractPatientFromDesc(t.description);
              const service = extractService(t);
              const status: TxStatus = t.status ?? 'pending';
              const duration = extractDurationMin(t);
              const notes = extractNotes(t);

              return (
                <div key={t.id} className="group">
                  {/* CARD */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOpen(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleOpen(t.id);
                      }
                    }}
                  >
                    <TransactionCard
                      transaction={{
                        ...t,
                        professionalName: prof,
                        patientName: patient,
                        service,
                        status,
                      }}
                      onEdit={handleEdit}
                      onDelete={deleteTransaction}
                      onUpdateStatus={(id, next) => updateTxStatus(id, next)}
                      isOpen={openId === t.id}
                    />
                  </div>

                  {/* DETALHES */}
                  {openId === t.id && (
                    <div className="mx-1 mt-[-6px] rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Categoria</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{service ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Data</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{t.date}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Profissional</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{prof ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Paciente</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">{patient ?? '—'}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-500">Duração</span>
                          </div>
                          <div className="pl-6 text-gray-900 font-medium">
                            {typeof duration === 'number' ? `${duration} min` : '—'}
                          </div>
                        </div>

                        {/* Removido o bloco "Pagamento" aqui */}
                        <div className="space-y-2 sm:col-span-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-4 h-4 rounded bg-gray-200" />
                            <span className="text-gray-500">Observações</span>
                          </div>
                          <div className="pl-6 text-gray-700">{notes ?? '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditTransactionModal
        isOpen={!!editing}
        transaction={editing}
        onClose={() => setEditing(null)}
        onSave={handleSaveEdit}
      />

      <AddTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default Finance;
