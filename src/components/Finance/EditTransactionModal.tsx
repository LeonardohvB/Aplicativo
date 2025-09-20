// src/components/Finance/EditTransactionModal.tsx
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Transaction } from '../../types';

interface EditTransactionModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (updates: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
    date: string;
  }) => Promise<void> | void;
}

// --- Helpers de Title Case ---
const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : '');
const titleCase = (input: string) => {
  if (!input) return '';
  return input
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.includes('-') ? w.split('-').map(cap).join('-') : cap(w)))
    .join(' ');
};

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    description: '',
    amount: 0,
    category: '',
    date: '',
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type,
        description: transaction.description ?? '',
        amount: Number(transaction.amount ?? 0),
        category: transaction.category ?? '',
        date: transaction.date ?? '',
      });
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      description: titleCase(formData.description).trim(),
      category: titleCase(formData.category).trim(),
      amount: Number(formData.amount),
      date: formData.date || new Date().toLocaleDateString('pt-BR'),
    };
    await onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Editar Transação</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                name="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })
                }
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                name="amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              onBlur={(e) =>
                setFormData((s) => ({ ...s, description: titleCase(e.target.value) }))
              }
              placeholder="Ex.: Recebimento de Pix"
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                onBlur={(e) =>
                  setFormData((s) => ({ ...s, category: titleCase(e.target.value) }))
                }
                placeholder="Ex.: Consultas"
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="text"
                name="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                placeholder="dd/mm/aaaa"
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;
