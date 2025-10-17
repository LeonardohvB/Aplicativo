import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (transaction: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
  }) => void;
}

/* -------- Helpers (Title Case preservando hífen) -------- */
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

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    description: '',
    amount: '',
    category: '',
  });

  const [errors, setErrors] = useState<{
    description?: string;
    amount?: string;
    category?: string;
  }>({});

  // limpa erros quando abrir
  useEffect(() => {
    if (isOpen) setErrors({});
  }, [isOpen]);

  const validate = () => {
    const e: typeof errors = {};
    if (!formData.description.trim()) e.description = 'Informe uma descrição.';
    const n = Number(String(formData.amount).replace(',', '.'));
    if (!formData.amount || Number.isNaN(n) || n <= 0) e.amount = 'Informe um valor válido maior que zero.';
    if (!formData.category.trim()) e.category = 'Informe a categoria.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputClass = (hasError?: boolean) =>
    [
      'w-full px-3 py-2 rounded-lg border transition-colors',
      'focus:outline-none focus:ring-2',
      hasError
        ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
        : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500',
    ].join(' ');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const description = titleCase(formData.description).trim();
    const category = titleCase(formData.category).trim();
    const amountNum = parseFloat(String(formData.amount).replace(',', '.'));

    onAdd({
      type: formData.type,
      description,
      amount: amountNum,
      category,
    });

    setFormData({ type: 'income', description: '', amount: '', category: '' });
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));
    setErrors((s) => ({ ...s, [e.target.name as keyof typeof s]: undefined }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Adicionar Transação</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Tipo
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={inputClass(false)}
            >
              <option value="income">Receita</option>
              <option value="expense">Despesa</option>
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Descrição
            </label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              onBlur={(e) =>
                setFormData((s) => ({ ...s, description: titleCase(e.target.value) }))
              }
              placeholder="Ex.: Recebimento de Pix"
              className={inputClass(!!errors.description)}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          {/* Valor */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Valor (R$)
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="130.00"
              className={inputClass(!!errors.amount)}
              aria-invalid={!!errors.amount}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-600">{errors.amount}</p>
            )}
          </div>

          {/* Categoria */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Categoria
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              onBlur={(e) =>
                setFormData((s) => ({ ...s, category: titleCase(e.target.value) }))
              }
              placeholder="Ex.: Consultas, Materiais, Equipamentos"
              className={inputClass(!!errors.category)}
              aria-invalid={!!errors.category}
            />
            {errors.category && (
              <p className="mt-1 text-xs text-red-600">{errors.category}</p>
            )}
          </div>

          <div className="pt-4 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;
