// src/hooks/useProfessionals.ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Professional } from '../types';
import { deleteAllAvatarsForProfessional } from '../lib/avatars';

// --- Tipos vindos do DB (snake_case) ---
type DbProfessional = {
  id: string;
  name: string;
  specialty: string;
  commission_rate: number | null;
  patients: number | null;
  is_active: boolean;
  avatar_path: string | null;       // URL pública ou caminho
  avatar_updated_at: string | null; // timestamp para bust de cache
  phone: string | null;
  registration_code: string;        // NOT NULL (migration nova)
};

// --- Input para criar/atualizar ---
type NewProfessionalInput = {
  name: string;
  specialty: string;
  phone: string;
  registrationCode: string;   // obrigatório
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
  isActive: boolean;                // camelCase no app → is_active no DB
  commissionRate: number;           // camelCase no app → commission_rate no DB
  patients: number;
}>;

// --- Mapper DB → App (camelCase) ---
function mapDbProfessional(p: DbProfessional): Professional {
  return {
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    // se você salva URL pública em avatar_path, funciona direto; se for apenas o caminho,
    // substitua aqui por um helper que gere a URL pública.
    avatar: p.avatar_path,
    avatarUpdatedAt: p.avatar_updated_at ?? undefined,
    commissionRate: p.commission_rate ?? 20, // default 20% se vier null
    patients: p.patients ?? 0,
    isActive: p.is_active,
    phone: p.phone ?? '',
    registrationCode: p.registration_code,
  };
}

export const useProfessionals = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- READ ----
  const fetchProfessionals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          specialty,
          commission_rate,
          patients,
          is_active,
          avatar_path,
          avatar_updated_at,
          phone,
          registration_code
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (data ?? []).map(mapDbProfessional);
      setProfessionals(mapped);
    } catch (err: any) {
      if (err?.message === 'Supabase not configured') {
        console.warn('⚠️ Supabase not configured - using empty data');
        setProfessionals([]);
      } else {
        console.error('Error fetching professionals:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- CREATE ----
  const addProfessional = async (professional: NewProfessionalInput) => {
    try {
      const toDb = {
        name: professional.name,
        specialty: professional.specialty,
        patients: 0,
        is_active: true,
        commission_rate: professional.commissionRate ?? 20,
        avatar_path: null,
        avatar_updated_at: null,
        phone: professional.phone ?? null,
        registration_code: professional.registrationCode, // obrigatório
      };

      const { data, error } = await supabase
        .from('professionals')
        .insert([toDb])
        .select(`
          id,
          name,
          specialty,
          commission_rate,
          patients,
          is_active,
          avatar_path,
          avatar_updated_at,
          phone,
          registration_code
        `)
        .single();

      if (error) throw error;

      const created = mapDbProfessional(data as DbProfessional);
      setProfessionals((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.warn('⚠️ Supabase not configured - adding professional locally:', err);
      // Fallback local
      const local: Professional = {
        id: Date.now().toString(),
        name: professional.name,
        specialty: professional.specialty,
        avatar:
          'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
        avatarUpdatedAt: undefined,
        commissionRate: professional.commissionRate ?? 20,
        patients: 0,
        isActive: true,
        phone: professional.phone ?? '',
        registrationCode: professional.registrationCode,
      };
      setProfessionals((prev) => [local, ...prev]);
      return local;
    }
  };

  // ---- UPDATE ----
  const updateProfessional = async (id: string, updates: UpdatePayload) => {
    try {
      // Monta payload para o DB somente com campos presentes
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

      // (Opcional) se vier "avatar" direto (URL pública) e você salva no avatar_path:
      if (updates.avatar !== undefined && updates.avatar_path === undefined) {
        toDb.avatar_path = updates.avatar;
      }

      if (Object.keys(toDb).length === 0) return;

      const { error } = await supabase.from('professionals').update(toDb).eq('id', id);
      if (error) throw error;

      // Atualiza estado local em camelCase
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name: updates.name ?? p.name,
                specialty: updates.specialty ?? p.specialty,
                avatar: updates.avatar_path ?? updates.avatar ?? p.avatar,
                avatarUpdatedAt: updates.avatar_updated_at ?? p.avatarUpdatedAt,
                isActive: updates.isActive ?? p.isActive,
                commissionRate: updates.commissionRate ?? p.commissionRate,
                patients: updates.patients ?? p.patients,
                phone: updates.phone ?? p.phone,
                registrationCode: updates.registrationCode ?? p.registrationCode,
              }
            : p
        )
      );
    } catch (err) {
      console.warn('Error updating professional, applying locally:', err);
      // Fallback local
      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...((): Partial<Professional> => {
                  const local: Partial<Professional> = {};
                  if (updates.name !== undefined) local.name = updates.name;
                  if (updates.specialty !== undefined) local.specialty = updates.specialty;
                  if (updates.commissionRate !== undefined) local.commissionRate = updates.commissionRate;
                  if (updates.patients !== undefined) local.patients = updates.patients;
                  if (updates.isActive !== undefined) local.isActive = updates.isActive;
                  if (updates.avatar_path !== undefined) local.avatar = updates.avatar_path;
                  if (updates.avatar !== undefined) local.avatar = updates.avatar;
                  if (updates.avatar_updated_at !== undefined) local.avatarUpdatedAt = updates.avatar_updated_at;
                  if (updates.phone !== undefined) local.phone = updates.phone;
                  if (updates.registrationCode !== undefined) local.registrationCode = updates.registrationCode;
                  return local;
                })(),
              }
            : p
        )
      );
    }
  };

  // ---- TOGGLE ----
  const toggleProfessional = async (id: string) => {
    try {
      const current = professionals.find((p) => p.id === id);
      if (!current) return;

      const next = !current.isActive;

      const { error } = await supabase
        .from('professionals')
        .update({ is_active: next })
        .eq('id', id);

      if (error) throw error;

      setProfessionals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive: next } : p))
      );
    } catch (err) {
      console.error('Error toggling professional:', err);
    }
  };

 // ---- DELETE ----
const deleteProfessional = async (id: string) => {
  try {
    // Remove todos os arquivos do prefixo do profissional (se você usa essa estrutura)
    await deleteAllAvatarsForProfessional(id);

    // Remove o profissional do DB
    const { error } = await supabase.from('professionals').delete().eq('id', id);
    if (error) throw error;

    setProfessionals((prev) => prev.filter((p) => p.id !== id));
  } catch (err) {
    console.error('Error deleting professional:', err);
    throw err;
  }
};



  useEffect(() => {
    fetchProfessionals();
  }, []);

  return {
    professionals,
    loading,
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
    refetch: fetchProfessionals,
  };
};
