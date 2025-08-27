// src/lib/mappers.ts
import { Professional } from '../types';

type DbProfessional = {
  id: string;
  name: string;
  specialty: string;
  value: number;
  commission_rate: number | null;
  patients: number | null;
  is_active: boolean;
  avatar_path: string | null;
  avatar_updated_at: string | null;
};

export function mapDbProfessional(p: DbProfessional): Professional {
  return {
    id: p.id,
    name: p.name,
    specialty: p.specialty,
    value: p.value,
    commissionRate: p.commission_rate ?? 0,
    patients: p.patients ?? 0,
    isActive: p.is_active,
    avatar: p.avatar_path,               // já vem URL pública se você salva assim
    avatarUpdatedAt: p.avatar_updated_at // usado no ?v=
  };
}
