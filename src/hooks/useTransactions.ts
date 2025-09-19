// src/hooks/useTransactions.ts
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Transaction, AppointmentHistory } from '../types';
import { transactions as mockTransactions } from '../data/mockData';

type TxStatus = 'pending' | 'paid';

/** Transação enriquecida (sem null — apenas undefined) */
export type Tx = Transaction & {
  status?: TxStatus;

  // extras que podem vir da transactions ou do histórico
  service?: string;
  patientName?: string;
  professionalName?: string;
  startedAt?: string;
  finishedAt?: string;
  actualDuration?: number;
  notes?: string;

  // vínculos
  historyId?: string;   // transactions.history_id ou appointment_history_id
  slotId?: string;

  _h?: Partial<AppointmentHistory>;
};

const isColNotFound = (e: any) => e?.code === '42703';
const n = (v: any): number => Number(v ?? 0);
const s = (v: any): string | undefined =>
  v === null || v === undefined || v === '' ? undefined : String(v);

export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Mapeia uma linha do DB/mock para Tx (sem histórico ainda) */
  const mapRowBase = (item: any): Tx => {
    const raw = item?.status;
    const status: TxStatus | undefined =
      raw === 'paid' ? 'paid' : raw === 'pending' ? 'pending' : undefined;

    return {
      id: String(item.id),
      type: item.type as 'income' | 'expense',
      description: item.description ?? '',
      amount: n(item.amount),
      date: item.date ?? '',
      category: item.category ?? '',
      professionalId: item.professional_id ?? undefined,

      status,
      service: s(item.service),
      patientName: s(item.patient_name),
      professionalName: s(item.professional_name),
      startedAt: s(item.startedAt ?? item.started_at),
      finishedAt: s(item.finishedAt ?? item.finished_at),
      actualDuration: item.actualDuration ?? item.actual_duration ?? undefined,
      notes: s(item.notes ?? item.observation ?? item.observations),

      historyId: s(item.history_id ?? item.appointment_history_id),
      slotId: s(item.slot_id),
    };
  };

  /** Mescla dados do histórico no Tx (sem sobrescrever o que já veio) */
  const mergeHistory = (tx: Tx, h?: Partial<AppointmentHistory>): Tx => {
    if (!h) return tx;
    return {
      ...tx,
      _h: h,
      professionalName: tx.professionalName ?? h.professionalName ?? undefined,
      patientName: tx.patientName ?? h.patientName ?? undefined,
      service: tx.service ?? h.service ?? tx.category ?? undefined,
      actualDuration:
        tx.actualDuration ??
        (typeof h.actualDuration === 'number' ? h.actualDuration : undefined),
      startedAt: tx.startedAt ?? h.startedAt ?? undefined,
      finishedAt: tx.finishedAt ?? h.finishedAt ?? undefined,
      notes: tx.notes ?? h.notes ?? undefined,
    };
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured) {
      setTransactions((mockTransactions as Transaction[]).map(mapRowBase));
      setError('Usando dados de demonstração (Supabase não configurado).');
      setLoading(false);
      return;
    }

    try {
      let q = supabase.from('transactions').select('*');
      let { data, error } = await q.order('created_at', { ascending: false });

      if (isColNotFound(error)) {
        const byDate = await supabase.from('transactions').select('*').order('date', { ascending: false });
        data = byDate.data;
        error = byDate.error;
      }
      if (isColNotFound(error)) {
        const plain = await supabase.from('transactions').select('*');
        data = plain.data ?? [];
        data.sort((a: any, b: any) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
      } else if (error) {
        throw error;
      }

      const base: Tx[] = (data ?? []).map(mapRowBase);

      // enriquecer com appointment_history quando houver
      const hIds = Array.from(
        new Set(base.map((t) => t.historyId).filter((x): x is string => !!x))
      );
      if (hIds.length > 0) {
        const hq = await supabase.from('appointment_history').select('*').in('id', hIds);
        if (!hq.error && hq.data) {
          const map = new Map<string, AppointmentHistory>();
          (hq.data as AppointmentHistory[]).forEach((h) => map.set(h.id, h));
          setTransactions(base.map((t) => mergeHistory(t, map.get(String(t.historyId)))));
          setLoading(false);
          return;
        }
      }

      setTransactions(base);
    } catch (e) {
      console.warn('Erro ao buscar transações; usando mock:', e);
      setTransactions((mockTransactions as Transaction[]).map(mapRowBase));
      setError('Usando dados de demonstração - verifique a tabela "transactions".');
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (t: {
    type: 'income' | 'expense';
    description: string;
    amount: number;
    category: string;
    historyId?: string;
    status?: TxStatus;
  }) => {
    setError(null);

    if (!isSupabaseConfigured) {
      const local: Tx = {
        id: Date.now().toString(),
        type: t.type,
        description: t.description,
        amount: t.amount,
        date: new Date().toLocaleDateString('pt-BR'),
        category: t.category,
        status: t.status ?? 'pending',
        historyId: t.historyId,
      };
      setTransactions((prev) => [local, ...prev]);
      setError('Transação salva localmente (Supabase não configurado).');
      return;
    }

    try {
      const payload: any = {
        type: t.type,
        description: t.description,
        amount: t.amount,
        date: new Date().toLocaleDateString('pt-BR'),
        category: t.category,
        status: t.status ?? 'pending',
      };
      if (t.historyId) payload.history_id = t.historyId;

      const { data, error } = await supabase
        .from('transactions')
        .insert([payload])
        .select('*')
        .single();
      if (error) throw error;

      let tx = mapRowBase(data);
      if (tx.historyId) {
        const h = await supabase.from('appointment_history').select('*').eq('id', tx.historyId).maybeSingle();
        if (!h.error && h.data) tx = mergeHistory(tx, h.data as AppointmentHistory);
      }

      setTransactions((prev) => [tx, ...prev]);
    } catch (e) {
      console.error('Erro ao adicionar transação:', e);
      setError('Erro ao adicionar transação. Mantendo localmente.');
      const local: Tx = {
        id: Date.now().toString(),
        type: t.type,
        description: t.description,
        amount: t.amount,
        date: new Date().toLocaleDateString('pt-BR'),
        category: t.category,
        status: t.status ?? 'pending',
        historyId: t.historyId,
      };
      setTransactions((prev) => [local, ...prev]);
    }
  };

  const deleteTransaction = async (id: string) => {
    setError(null);

    if (!isSupabaseConfigured) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setError('Exclusão local (Supabase não configurado).');
      return;
    }

    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error('Erro ao excluir transação:', e);
      setError('Erro ao excluir transação. Removendo localmente.');
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const editTransaction = async (
    id: string,
    updates: Partial<
      Pick<Transaction, 'type' | 'description' | 'amount' | 'category' | 'date' | 'professionalId'>
    > & {
      status?: TxStatus;
      historyId?: string;
      service?: string;
      patientName?: string;
      professionalName?: string;
      startedAt?: string;
      finishedAt?: string;
      actualDuration?: number;
      notes?: string;
    }
  ) => {
    setError(null);

    // patch local (tudo com undefined, sem null)
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              professionalId:
                updates.professionalId !== undefined ? updates.professionalId : t.professionalId,
            }
          : t
      )
    );

    if (!isSupabaseConfigured) return;

    const base: Record<string, any> = {};
    if (updates.type !== undefined) base.type = updates.type;
    if (updates.description !== undefined) base.description = updates.description;
    if (updates.amount !== undefined) base.amount = updates.amount;
    if (updates.category !== undefined) base.category = updates.category;
    if (updates.date !== undefined) base.date = updates.date;
    if (updates.professionalId !== undefined) base.professional_id = updates.professionalId;
    if (updates.status !== undefined) base.status = updates.status;
    if (updates.historyId !== undefined) base.history_id = updates.historyId;

    try {
      const up = await supabase.from('transactions').update(base).eq('id', id);
      if (up.error) throw up.error;
    } catch (e: any) {
      console.error('editTransaction:', e);
      setError(e?.message ?? 'Erro ao editar transação');
    }
  };

  const updateTxStatus = async (id: string, next: TxStatus) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status: next } : t)));

    if (!isSupabaseConfigured) return;
    try {
      const up = await supabase.from('transactions').update({ status: next }).eq('id', id);
      if (up.error && !isColNotFound(up.error)) throw up.error;
    } catch (e) {
      console.warn('updateTxStatus fallback local:', e);
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
    editTransaction,
    updateTxStatus,
  };
};
