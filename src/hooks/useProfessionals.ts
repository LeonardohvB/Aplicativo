// src/hooks/useProfessionals.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Professional } from '../types';
import { deleteAllAvatarsForProfessional } from '../lib/avatars';

/* ========= Tipos vindos do DB (snake_case) ========= */
type DbProfessional = {
  id: string;
  name: string;
  specialty: string | null;
  commission_rate: number | null;
  patients: number | null;
  is_active: boolean;
  avatar_path: string | null;
  avatar_updated_at: string | null;
  phone: string | null;
  registration_code: string;
  cpf: string | null;                 // usado para validação / exibição
  deleted_at: string | null;          // arquivado quando ≠ null
  created_at?: string;
};

/* ========= Inputs ========= */
type NewProfessionalInput = {
  name: string;
  specialty: string;
  phone: string;
  registrationCode: string;   // obrigatório
  cpf: string;                // obrigatório p/ cadastrar
  commissionRate?: number;    // opcional; default 20
};

type UpdatePayload = Partial<{
  name: string;
  specialty: string;
  phone: string;
  registrationCode: string;
  avatar: string | null;            // URL pública (frontend)
  avatar_path: string | null;       // caminho/URL salvo no DB
  avatar_updated_at: string | null; // timestamp
  isActive: boolean;                // camel -> snake
  commissionRate: number;           // camel -> snake
  patients: number;
  cpf: string;                      // (mantido para eventual edição via admin)
}>;

/* ========= Utils CPF ========= */
const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

async function cpfExistsOnDb(cpf: string, ignoreId?: string) {
  const { data, error } = await supabase
    .from('professionals')
    .select('id, cpf')
    .not('cpf', 'is', null);

  if (error) throw error;

  const target = onlyDigits(cpf);
  return (data ?? []).some((row: any) => {
    if (ignoreId && row.id === ignoreId) return false;
    return onlyDigits(row.cpf) === target;
  });
}

/* ========= Mapper DB → App (camelCase) ========= */
function mapDbProfessional(p: DbProfessional): Professional {
  const raw = p.avatar_path ?? null;
  const clean = raw ? decodeURIComponent(raw) : null;

  let avatar: string | null = clean;
  if (clean && p.avatar_updated_at) {
    const sep = clean.includes('?') ? '&' : '?';
    avatar = `${clean}${sep}v=${encodeURIComponent(p.avatar_updated_at)}`;
  }

  return {
    id: p.id,
    name: p.name,
    specialty: p.specialty ?? '',
    avatar,
    avatarUpdatedAt: p.avatar_updated_at ?? undefined,
    commissionRate: p.commission_rate ?? 20,
    patients: p.patients ?? 0,
    isActive: p.is_active,
    phone: p.phone ?? '',
    registrationCode: p.registration_code,
    cpf: p.cpf ?? undefined,            // ⬅️ disponibiliza para o Edit modal

    // flags de arquivamento p/ UI
    isArchived: !!p.deleted_at,
    archivedAt: p.deleted_at,
  };
}

/* ========= Helper de filtro ========= */
type RefetchOpts = {
  /** se true, traz apenas arquivados */
  onlyArchived?: boolean;
  /** se true, traz ativos + arquivados (sem filtro de deleted_at) */
  includeArchived?: boolean;
  /** dentro dos NÃO arquivados, incluir inativos (default: incluir) */
  includeInactive?: boolean;
};

export const useProfessionals = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  /* ========= READ ========= */
  const fetchProfessionals = useCallback(async (opts?: RefetchOpts) => {
    setLoading(true);
    try {
      let q = supabase
        .from('professionals')
        .select(`
          id, name, specialty, commission_rate, patients, is_active,
          avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
        `)
        .order('created_at', { ascending: false });

      if (opts?.onlyArchived) {
        q = q.not('deleted_at', 'is', null);
      } else if (!opts?.includeArchived) {
        q = q.is('deleted_at', null);
        if (opts?.includeInactive === false) {
          q = q.eq('is_active', true);
        }
      }

      const { data, error } = await q;
      if (error) throw error;

      setProfessionals(((data ?? []) as DbProfessional[]).map(mapDbProfessional));
    } finally {
      setLoading(false);
    }
  }, []);

  /* ========= CREATE ========= */
  const addProfessional = useCallback(async (professional: NewProfessionalInput) => {
    // validação/duplicidade do CPF
    const cpfDigits = onlyDigits(professional.cpf);
    if (!cpfDigits || cpfDigits.length !== 11) {
      throw new Error('Informe um CPF válido (11 dígitos).');
    }
    const duplicated = await cpfExistsOnDb(professional.cpf);
    if (duplicated) {
      throw new Error('Este CPF já está cadastrado para outro profissional.');
    }

    const toDb = {
      name: professional.name,
      specialty: professional.specialty,
      patients: 0,
      is_active: true,
      commission_rate: professional.commissionRate ?? 20,
      avatar_path: null as string | null,
      avatar_updated_at: null as string | null,
      phone: professional.phone ?? null,
      registration_code: professional.registrationCode,
      cpf: professional.cpf,                       // salva o cpf informado
      deleted_at: null as string | null,
    };

    const { data, error } = await supabase
      .from('professionals')
      .insert([toDb])
      .select(`
        id, name, specialty, commission_rate, patients, is_active,
        avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
      `)
      .single();

    if (error) throw error;

    const created = mapDbProfessional(data as DbProfessional);
    setProfessionals(prev => [created, ...prev]);
    return created;
  }, []);

  /* ========= UPDATE ========= */
  const updateProfessional = useCallback(async (id: string, updates: UpdatePayload) => {
    // se for alterar cpf, validar e checar duplicidade (ignorando o próprio id)
    if (updates.cpf !== undefined) {
      const cpfDigits = onlyDigits(updates.cpf);
      if (!cpfDigits || cpfDigits.length !== 11) {
        throw new Error('Informe um CPF válido (11 dígitos).');
      }
      const duplicated = await cpfExistsOnDb(updates.cpf, id);
      if (duplicated) {
        throw new Error('Este CPF já está cadastrado para outro profissional.');
      }
    }

    const toDb: Record<string, any> = {};
    if (updates.name !== undefined) toDb.name = updates.name;
    if (updates.specialty !== undefined) toDb.specialty = updates.specialty;
    if (updates.avatar_path !== undefined) toDb.avatar_path = updates.avatar_path;
    if (updates.avatar_updated_at !== undefined) toDb.avatar_updated_at = updates.avatar_updated_at;
    if (updates.isActive !== undefined) toDb.is_active = updates.isActive;
    if (updates.commissionRate !== undefined) toDb.commission_rate = updates.commissionRate;
    if (updates.patients !== undefined) toDb.patients = updates.patients;
    if (updates.phone !== undefined) toDb.phone = updates.phone;
    if (updates.registrationCode !== undefined) toDb.registration_code = updates.registrationCode;
    if (updates.cpf !== undefined) toDb.cpf = updates.cpf;
    if (updates.avatar !== undefined && updates.avatar_path === undefined) {
      toDb.avatar_path = updates.avatar;
    }

    if (Object.keys(toDb).length === 0) return;

    const { data, error } = await supabase
      .from('professionals')
      .update(toDb)
      .eq('id', id)
      .select(`
        id, name, specialty, commission_rate, patients, is_active,
        avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
      `)
      .single();

    if (error) throw error;

    const updated = mapDbProfessional(data as DbProfessional);
    setProfessionals(prev => prev.map(p => (p.id === id ? { ...p, ...updated } : p)));
  }, []);

  /* ========= TOGGLE ATIVO/INATIVO ========= */
  const toggleProfessional = useCallback(async (id: string) => {
    const current = professionals.find(p => p.id === id);
    if (!current) return;
    const next = !current.isActive;

    const { error, data } = await supabase
      .from('professionals')
      .update({ is_active: next })
      .eq('id', id)
      .select('id, is_active')
      .single();

    if (error) throw error;

    setProfessionals(prev => prev.map(p => (p.id === id ? { ...p, isActive: (data as any).is_active } : p)));
  }, [professionals]);

  /* ========= ARCHIVE (soft delete) ========= */
  const archiveProfessional = useCallback(async (id: string) => {
    const patch = { is_active: false, deleted_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('professionals')
      .update(patch)
      .eq('id', id)
      .select(`
        id, name, specialty, commission_rate, patients, is_active,
        avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
      `)
      .single();

    if (error) throw error;

    const updated = mapDbProfessional(data as DbProfessional);
    setProfessionals(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  }, []);

  /* ========= RESTORE ========= */
  const restoreProfessional = useCallback(async (id: string) => {
    const patch = { deleted_at: null, is_active: true };
    const { data, error } = await supabase
      .from('professionals')
      .update(patch)
      .eq('id', id)
      .select(`
        id, name, specialty, commission_rate, patients, is_active,
        avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
      `)
      .single();

    if (error) throw error;

    const updated = mapDbProfessional(data as DbProfessional);
    setProfessionals(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  }, []);

  /* ========= DELETE (hard) ========= */
  const deleteProfessional = useCallback(async (id: string) => {
    await deleteAllAvatarsForProfessional(id);
    const { error } = await supabase.from('professionals').delete().eq('id', id);
    if (error) throw error;
    setProfessionals(prev => prev.filter(p => p.id !== id));
  }, []);

  /* ========= bootstrap ========= */
  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  return {
    professionals,
    loading,
    // CRUD
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
    archiveProfessional,
    restoreProfessional,
    // fetch
    refetch: fetchProfessionals,
  };
};
