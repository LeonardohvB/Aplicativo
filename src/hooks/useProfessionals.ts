import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Professional } from '../types';

type NewProfessionalInput = {
  name: string;
  specialty: string;
  value: number;
};

type UpdatePayload = Partial<{
  name: string;
  specialty: string;
  value: number;
  avatar: string;            // URL pública
  avatar_path: string;       // (opcional) caminho no Storage
  avatar_updated_at: string; // (opcional) quando trocou
  isActive: boolean;         // mapeia para is_active no DB
}>;

export const useProfessionals = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfessionals = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message === 'Supabase not configured') {
          console.warn('⚠️ Supabase not configured - using empty data');
          setProfessionals([]);
          return;
        }
        throw error;
      }

      const formattedData: Professional[] =
        data?.map((item) => ({
          id: item.id,
          name: item.name,
          specialty: item.specialty,
          avatar: item.avatar,
          value: Number(item.value),
          commissionRate: 20, // default 20%
          patients: item.patients,
          isActive: item.is_active,
        })) || [];

      setProfessionals(formattedData);
    } catch (error) {
      console.error('Error fetching professionals:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProfessional = async (professional: NewProfessionalInput) => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .insert([
          {
            name: professional.name,
            specialty: professional.specialty,
            value: professional.value,
            patients: 0,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const newProfessional: Professional = {
        id: data.id,
        name: data.name,
        specialty: data.specialty,
        avatar: data.avatar,
        value: Number(data.value),
        commissionRate: 20,
        patients: data.patients,
        isActive: data.is_active,
      };

      setProfessionals((prev) => [newProfessional, ...prev]);
    } catch (err) {
      console.warn('⚠️ Supabase not configured - adding professional locally:', err);

      // fallback local
      const newProfessional: Professional = {
        id: Date.now().toString(),
        name: professional.name,
        specialty: professional.specialty,
        avatar:
          'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
        value: professional.value,
        commissionRate: 20,
        patients: 0,
        isActive: true,
      };

      setProfessionals((prev) => [newProfessional, ...prev]);
    }
  };

  const updateProfessional = async (id: string, updates: UpdatePayload) => {
    try {
      // monta payload apenas com os campos presentes
      const toDb: Record<string, any> = {};
      if (updates.name !== undefined)        toDb.name = updates.name;
      if (updates.specialty !== undefined)   toDb.specialty = updates.specialty;
      if (updates.value !== undefined)       toDb.value = updates.value;
      if (updates.avatar !== undefined)      toDb.avatar = updates.avatar;
      if (updates.avatar_path !== undefined) toDb.avatar_path = updates.avatar_path;
      if (updates.avatar_updated_at !== undefined) toDb.avatar_updated_at = updates.avatar_updated_at;
      if (updates.isActive !== undefined)    toDb.is_active = updates.isActive;

      if (Object.keys(toDb).length === 0) return;

      const { error } = await supabase
        .from('professionals')
        .update(toDb)
        .eq('id', id);

      if (error) throw error;

      // atualiza estado local
      setProfessionals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    } catch (error) {
      console.warn('Error updating professional, updating locally:', error);
      // fallback local
      setProfessionals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    }
  };

  const toggleProfessional = async (id: string) => {
    try {
      const professional = professionals.find((p) => p.id === id);
      if (!professional) return;

      const { error } = await supabase
        .from('professionals')
        .update({ is_active: !professional.isActive })
        .eq('id', id);

      if (error) throw error;

      setProfessionals((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, isActive: !p.isActive } : p
        )
      );
    } catch (error) {
      console.error('Error toggling professional:', error);
    }
  };

  const deleteProfessional = async (id: string) => {
    try {
      const { error } = await supabase
        .from('professionals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProfessionals((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Error deleting professional:', error);
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
  };
};
