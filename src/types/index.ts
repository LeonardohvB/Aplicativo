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
  date: string;
  startTime: string;
  endTime: string;
  consultationDuration: number; // em minutos
  bufferDuration: number;       // em minutos
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
  startedAt?: string;  // quando foi iniciado (ISO)
  finishedAt?: string; // quando foi finalizado (ISO)
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

/* ====== Financeiro ====== */

export type TransactionStatus = 'pending' | 'paid';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;                   // ISO (YYYY-MM-DD)
  category: string;
  slotId?: string;            // 👈 vínculo com o atendimento
 
  
  // Relacionamentos (opcionais) — úteis para preencher o card de detalhes:
  professionalId?: string;
  professionalName?: string;
  patientId?: string;
  patientName?: string;
  service?: string;

  // Pagamento
  status?: TransactionStatus;     // default: 'paid' (se não vier do DB)
  paymentMethod?: string | null;  // ex: 'pix', 'dinheiro', 'cartao'...
  paidAt?: string | null;         // ISO datetime quando quitado
  dueDate?: string | null;        // opcional: data de vencimento
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
  date: string;
  startTime: string;
  endTime: string;
  status: 'concluido' | 'cancelado' | 'no_show';
  billingMode: 'clinica' | 'profissional';
  clinicPercentage: number;
  notes?: string;
  completedAt: string;
  actualDuration?: number; // Duração real em minutos
  startedAt?: string;      // Quando foi iniciado
  finishedAt?: string;     // Quando foi finalizado
}

export interface DashboardStats {
  appointmentsToday: number;
  monthlyRevenue: number;
  weeklyAppointments: number;
  totalBalance: number;
  totalRevenue: number;
  totalExpenses: number;
}
// src/types.ts
export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  date: string;
  category: string;
  professionalId?: string;

}
