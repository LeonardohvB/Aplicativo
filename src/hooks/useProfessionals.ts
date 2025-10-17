// src/hooks/useProfessionals.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Professional } from '../types';
import { deleteAllAvatarsForProfessional } from '../lib/avatars';

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
  cpf: string | null;
  deleted_at: string | null;
  created_at?: string;
};

type NewProfessionalInput = {
  name: string;
  specialty: string;
  phone: string;
  registrationCode: string;
  cpf: string;
  commissionRate?: number;
};

type UpdatePayload = Partial<{
  name: string;
  specialty: string;
  phone: string;
  registrationCode: string;
  avatar: string | null;
  avatar_path: string | null;
  avatar_updated_at: string | null;
  isActive: boolean;
  commissionRate: number;
  patients: number;
  cpf: string;
}>;

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
    cpf: p.cpf ?? undefined,
    isArchived: !!p.deleted_at,
    archivedAt: p.deleted_at,
  };
}

export type RefetchOpts = {
  onlyArchived?: boolean;      // só arquivados
  includeArchived?: boolean;   // todos (sem filtro deleted_at)
  includeInactive?: boolean;   // dentro dos não arquivados, incluir inativos
};

export const useProfessionals = (initialOpts?: RefetchOpts) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔒 “congela” as opções passadas na 1ª montagem
  const initialOptsRef = useRef<RefetchOpts | undefined>(initialOpts);

  // evita condição de corrida
  const fetchIdRef = useRef(0);

  const fetchProfessionals = useCallback(async (opts?: RefetchOpts) => {
    const myId = ++fetchIdRef.current;
    setLoading(true);
    try {
      let q = supabase
        .from('professionals')
        .select(`
          id, name, specialty, commission_rate, patients, is_active,
          avatar_path, avatar_updated_at, phone, registration_code, cpf, deleted_at, created_at
        `)
        .order('created_at', { ascending: false });

      const o = opts ?? {};
      if (o.onlyArchived) {
        q = q.not('deleted_at', 'is', null);
      } else if (!o.includeArchived) {
        q = q.is('deleted_at', null);
        if (o.includeInactive === false) q = q.eq('is_active', true);
      }

      const { data, error } = await q;
      if (error) throw error;

      if (myId === fetchIdRef.current) {
        setProfessionals(((data ?? []) as DbProfessional[]).map(mapDbProfessional));
      }
    } finally {
      if (myId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  const addProfessional = useCallback(async (p: NewProfessionalInput) => {
    const cpfDigits = onlyDigits(p.cpf);
    if (!cpfDigits || cpfDigits.length !== 11) throw new Error('Informe um CPF válido (11 dígitos).');
    if (await cpfExistsOnDb(p.cpf)) throw new Error('Este CPF já está cadastrado para outro profissional.');

    const toDb = {
      name: p.name,
      specialty: p.specialty,
      patients: 0,
      is_active: true,
      commission_rate: p.commissionRate ?? 20,
      avatar_path: null as string | null,
      avatar_updated_at: null as string | null,
      phone: p.phone ?? null,
      registration_code: p.registrationCode,
      cpf: p.cpf,
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

  const updateProfessional = useCallback(async (id: string, u: UpdatePayload) => {
    if (u.cpf !== undefined) {
      const cpfDigits = onlyDigits(u.cpf);
      if (!cpfDigits || cpfDigits.length !== 11) throw new Error('Informe um CPF válido (11 dígitos).');
      if (await cpfExistsOnDb(u.cpf, id)) throw new Error('Este CPF já está cadastrado para outro profissional.');
    }

    const toDb: Record<string, any> = {};
    if (u.name !== undefined) toDb.name = u.name;
    if (u.specialty !== undefined) toDb.specialty = u.specialty;
    if (u.avatar_path !== undefined) toDb.avatar_path = u.avatar_path;
    if (u.avatar_updated_at !== undefined) toDb.avatar_updated_at = u.avatar_updated_at;
    if (u.isActive !== undefined) toDb.is_active = u.isActive;
    if (u.commissionRate !== undefined) toDb.commission_rate = u.commissionRate;
    if (u.patients !== undefined) toDb.patients = u.patients;
    if (u.phone !== undefined) toDb.phone = u.phone;
    if (u.registrationCode !== undefined) toDb.registration_code = u.registrationCode;
    if (u.cpf !== undefined) toDb.cpf = u.cpf;
    if (u.avatar !== undefined && u.avatar_path === undefined) toDb.avatar_path = u.avatar;
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

  const toggleProfessional = useCallback(async (id: string) => {
    const current = professionals.find(p => p.id === id);
    if (!current) return;
    const next = !current.isActive;

    const { data, error } = await supabase
      .from('professionals')
      .update({ is_active: next })
      .eq('id', id)
      .select('id, is_active')
      .single();
    if (error) throw error;

    setProfessionals(prev => prev.map(p => (p.id === id ? { ...p, isActive: (data as any).is_active } : p)));
  }, [professionals]);

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

  const deleteProfessional = useCallback(async (id: string) => {
    await deleteAllAvatarsForProfessional(id);
    const { error } = await supabase.from('professionals').delete().eq('id', id);
    if (error) throw error;
    setProfessionals(prev => prev.filter(p => p.id !== id));
  }, []);

  /* ========= bootstrap ========= */
  useEffect(() => {
    // usa o snapshot das opções iniciais apenas no mount
    fetchProfessionals(initialOptsRef.current);
  }, [fetchProfessionals]);

  return {
    professionals,
    loading,
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
    archiveProfessional,
    restoreProfessional,
    refetch: fetchProfessionals,
  };
};
