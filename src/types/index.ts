// src/types/index.ts

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  avatar: string | null;          // URL público (pode ser null)
  avatarUpdatedAt?: string | null;
  commissionRate: number;
  patients: number;
  isActive: boolean;
  phone: string;                  // telefone do profissional (formato livre)
  registrationCode: string;
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
  date: string;                   // YYYY-MM-DD
  startTime: string;              // HH:MM
  endTime: string;                // HH:MM
  consultationDuration: number;   // em minutos
  bufferDuration: number;         // em minutos
  totalSlots: number;
  defaultPrice: number;
  defaultService: string;
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
  patientName?: string;
  patientPhone?: string;
  notes?: string;
  clinicPercentage?: number;

  // timestamps/metrics (opcionais)
  startedAt?: string | null;      // ISO quando iniciou
  finishedAt?: string | null;     // ISO quando finalizou
  actualDuration?: number | null; // minutos rastreados
  canceledAt?: string | null;     // ISO quando foi cancelado
  noShowAt?: string | null;       // ISO quando marcado no_show
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
  date: string;                   // YYYY-MM-DD
}

export interface Appointment {
  id: string;
  professionalId: string;
  professionalName: string;
  specialty: string;
  room: string;
  startTime: string;
  endTime: string;
  date: string;                   // YYYY-MM-DD
}

/* ====== Financeiro ====== */

export type TransactionStatus = 'pending' | 'paid';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;                   // YYYY-MM-DD
  category: string;
  slotId?: string;                // vínculo com o atendimento

  // Relacionamentos (opcionais)
  professionalId?: string;
  professionalName?: string;
  patientId?: string;
  patientName?: string;
  service?: string;

  // Pagamento
  status?: TransactionStatus;     // default: 'paid' (se não vier do DB)
  paymentMethod?: string | null;  // 'pix', 'dinheiro'...
  paidAt?: string | null;         // ISO datetime quando quitado
  dueDate?: string | null;        // opcional
}

/* ====== Histórico de atendimentos ====== */
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

  completedAt: string;            // (legado) pode ser igual a finishedAt
  actualDuration?: number;        // minutos

  // timestamps detalhados
  startedAt?: string | null;      // ISO
  finishedAt?: string | null;     // ISO
  canceledAt?: string | null;     // ISO — quando foi cancelado
  noShowAt?: string | null;       // ISO — quando marcado no_show
}

export interface DashboardStats {
  appointmentsToday: number;
  monthlyRevenue: number;
  weeklyAppointments: number;
  totalBalance: number;
  totalRevenue: number;
  totalExpenses: number;
}
