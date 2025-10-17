// adicione no tipo Professional
export type Professional = {
  id: string;
  name: string;
  specialty: string;
  avatar: string | null;
  avatarUpdatedAt?: string;
  commissionRate: number;
  patients: number;
  isActive: boolean;
  phone: string;
  registrationCode: string;

  // arquivamento
  isArchived: boolean;
  archivedAt: string | null;

  // ⬇️ novo
  cpf?: string;     // manter como opcional para retrocompatibilidade
};


export interface Patient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface AppointmentJourney {
  id: string;
  professionalId: string;
  professionalName: string;
  date: string;                   // YYYY-MM-DD
  startTime: string;              // HH:MM
  endTime: string;                // HH:MM
  consultationDuration: number;   // minutos
  bufferDuration: number;         // minutos
  totalSlots: number;
  defaultPrice: number;
  clinicPercentage: number;
}

export type AppointmentSlotStatus =
  | 'disponivel'
  | 'agendado'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado'
  | 'no_show';

export interface AppointmentSlot {
  id: string;
  journeyId: string;
  professionalId: string;
  patientId?: string;
  slotNumber: number;
  startTime: string;              // HH:MM
  endTime: string;                // HH:MM
  date: string;                   // YYYY-MM-DD
  status: AppointmentSlotStatus;
  service: string;
  price: number;
  billingMode: 'clinica' | 'profissional';
  modality: 'presencial' | 'online';
  patientName?: string;
  patientPhone?: string;
  notes?: string;
  clinicPercentage?: number;

  startedAt?: string | null;
  finishedAt?: string | null;
  actualDuration?: number | null;
  canceledAt?: string | null;
  noShowAt?: string | null;
  
}

export type TransactionStatus = 'pending' | 'paid';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;                   // YYYY-MM-DD
  category: string;
  slotId?: string;

  professionalId?: string;
  professionalName?: string;
  patientId?: string;
  patientName?: string;
  service?: string;

  status?: TransactionStatus;
  paymentMethod?: string | null;
  paidAt?: string | null;
  dueDate?: string | null;
}

export interface AppointmentHistory {
  owner_id: string | null;
  id: string;
  professionalId?: string;
  professionalName: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  patientCpf?: string | null;
  service: string;
  price: number;
  date: string;                   // YYYY-MM-DD
  startTime: string;              // HH:MM
  endTime: string;                // HH:MM
  status: 'concluido' | 'cancelado' | 'no_show';
  billingMode: 'clinica' | 'profissional';
  clinicPercentage: number;
  notes?: string;
  completedAt: string;
  actualDuration?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  modality?: 'presencial' | 'online';
  canceledAt?: string | null;
  noShowAt?: string | null;
}

export interface DashboardStats {
  appointmentsToday: number;
  monthlyRevenue: number;
  weeklyAppointments: number;
  totalBalance: number;
  totalRevenue: number;
  totalExpenses: number;
}
