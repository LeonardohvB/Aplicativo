export interface Professional {
  id: string;
  name: string;
  specialty: string;
  avatar: string | null;          // URL público (pode ser null)
  avatarUpdatedAt?: string | null; // <-- adicione isto
  value: number;
  commissionRate: number;
  patients: number;
  isActive: boolean;
}

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
  date: string;
  startTime: string;
  endTime: string;
  consultationDuration: number; // em minutos
  bufferDuration: number; // em minutos
  totalSlots: number;
  defaultPrice: number;
  defaultService: string;
  clinicPercentage: number;
}

export interface AppointmentSlot {
  id: string;
  journeyId: string;
  professionalId: string;
  patientId?: string;
  slotNumber: number;
  startTime: string;
  endTime: string;
  date: string;
  status: 'disponivel' | 'agendado' | 'em_andamento' | 'concluido' | 'cancelado' | 'no_show';
  service: string;
  price: number;
  billingMode: 'clinica' | 'profissional';
  patientName?: string;
  patientPhone?: string;
  notes?: string;
  clinicPercentage?: number;
  startedAt?: string; // Timestamp de quando foi iniciado
  finishedAt?: string; // Timestamp de quando foi finalizado
}

export interface FinancialEntry {
  id: string;
  slotId: string;
  professionalId?: string;
  type: 'receita_clinica' | 'repasse_profissional' | 'taxa_clinica';
  description: string;
  amount: number;
  status: 'pendente' | 'pago' | 'cancelado';
  billingMode: 'clinica' | 'profissional';
  date: string;
}

export interface Appointment {
  id: string;
  professionalId: string;
  professionalName: string;
  specialty: string;
  room: string;
  startTime: string;
  endTime: string;
  date: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category: string;
  professionalId?: string;
}

export interface AppointmentHistory {
  id: string;
  professionalId?: string;
  professionalName: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  service: string;
  price: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'concluido' | 'cancelado' | 'no_show';
  billingMode: 'clinica' | 'profissional';
  clinicPercentage: number;
  notes?: string;
  completedAt: string;
  actualDuration?: number; // Duração real em minutos
  startedAt?: string; // Quando foi iniciado
  finishedAt?: string; // Quando foi finalizado
}

export interface DashboardStats {
  appointmentsToday: number;
  monthlyRevenue: number;
  weeklyAppointments: number;
  totalBalance: number;
  totalRevenue: number;
  totalExpenses: number;
}