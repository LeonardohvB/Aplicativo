import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction } from '../types';
import { transactions as mockTransactions } from '../data/mockData';

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    try {
      setError(null);
      
      // Test Supabase connection first
      const { error: connectionError } = await supabase
        .from('transactions')
        .select('count')
        .limit(1);

      if (connectionError) {
        console.warn('Supabase connection failed, using mock data:', connectionError.message);
        setTransactions(mockTransactions);
        setError('Usando dados de demonstração - verifique a conexão com o banco de dados');
        return;
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        id: item.id,
        type: item.type as 'income' | 'expense',
        description: item.description,
        amount: Number(item.amount),
        date: item.date,
        category: item.category,
        professionalId: item.professional_id,
      })) || [];

      setTransactions(formattedData);
    } catch (error) {
      console.warn('Error fetching transactions, using mock data:', error);
      setTransactions(mockTransactions);
      setError('Usando dados de demonstração - verifique a conexão com o banco de dados');
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transaction: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
  }) => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('transactions')
        .insert([{
          type: transaction.type,
          description: transaction.description,
          amount: transaction.amount,
          date: new Date().toLocaleDateString('pt-BR'),
          category: transaction.category,
        }])
        .select()
        .single();

      if (error) throw error;

      const newTransaction: Transaction = {
        id: data.id,
        type: data.type,
        description: data.description,
        amount: Number(data.amount),
        date: data.date,
        category: data.category,
        professionalId: data.professional_id,
      };

      setTransactions(prev => [newTransaction, ...prev]);
    } catch (error) {
      console.error('Error adding transaction:', error);
      setError('Erro ao adicionar transação - verifique a conexão com o banco de dados');
      
      // Add to local state as fallback
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
        date: new Date().toLocaleDateString('pt-BR'),
        category: transaction.category,
      };
      setTransactions(prev => [newTransaction, ...prev]);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError('Erro ao excluir transação - verifique a conexão com o banco de dados');
      
      // Remove from local state as fallback
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    deleteTransaction,
  };
};