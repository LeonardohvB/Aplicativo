import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Professional } from '../types';

type NewProfessionalInput = {
  name: string;
  specialty: string;
  value: number;
};

type UpdatePayload = {
  name: string;
  specialty: string;
  value: number;
  avatar?: string;
};

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
        commissionRate: 20, // default 20%
        patients: data.patients,
        isActive: data.is_active,
      };

      setProfessionals((prev) => [newProfessional, ...prev]);
    } catch (err) {
      console.warn(
        '⚠️ Supabase not configured - adding professional locally:',
        err
      );

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
      // tipagem explícita (sem any)
      const updateData: UpdatePayload = {
        name: updates.name,
        specialty: updates.specialty,
        value: updates.value,
        ...(updates.avatar ? { avatar: updates.avatar } : {}),
      };

      const { error } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setProfessionals((prev) =>
        prev.map((prof) => (prof.id === id ? { ...prof, ...updates } : prof))
      );
    } catch (error) {
      console.warn(
        'Error updating professional, updating locally:',
        error
      );
      // fallback local
      setProfessionals((prev) =>
        prev.map((prof) => (prof.id === id ? { ...prof, ...updates } : prof))
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
        prev.map((prof) =>
          prof.id === id ? { ...prof, isActive: !prof.isActive } : prof
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

      setProfessionals((prev) => prev.filter((prof) => prof.id !== id));
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
