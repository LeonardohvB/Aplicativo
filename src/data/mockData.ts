import { Professional, Appointment, Transaction } from '../types';

export const professionals: Professional[] = [
  {
    id: '1',
    name: 'Dra. Ana Silva',
    specialty: 'Nutricionista',
    avatar: 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    value: 130,
    patients: 9,
    isActive: true,
  },
  {
    id: '2',
    name: 'Dra. Marina Santos',
    specialty: 'Fonoaudióloga',
    avatar: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    value: 130,
    patients: 16,
    isActive: true,
  },
  {
    id: '3',
    name: 'Dra. Carla Oliveira',
    specialty: 'Psicopedagoga',
    avatar: 'https://images.pexels.com/photos/5452268/pexels-photo-5452268.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    value: 120,
    patients: 8,
    isActive: false,
  },
];

export const appointments: Appointment[] = [
  {
    id: '1',
    professionalId: '1',
    professionalName: 'Dra. Ana Silva',
    specialty: 'Nutrição',
    room: 'Sala 1',
    startTime: '08:00',
    endTime: '12:00',
    date: '2024-08-21',
  },
  {
    id: '2',
    professionalId: '2',
    professionalName: 'Dra. Marina Santos',
    specialty: 'Fonoaudiologia',
    room: 'Sala 1',
    startTime: '14:00',
    endTime: '18:00',
    date: '2024-08-21',
  },
  {
    id: '3',
    professionalId: '3',
    professionalName: 'Dra. Carla Oliveira',
    specialty: 'Psicopedagogia',
    room: 'Sala 2',
    startTime: '09:00',
    endTime: '13:00',
    date: '2024-08-21',
  },
];

export const transactions: Transaction[] = [
  {
    id: '1',
    type: 'income',
    description: 'Consulta - Dra. Ana Silva',
    amount: 130,
    date: '21/08/2025',
    category: 'Consultas',
    professionalId: '1',
  },
  {
    id: '2',
    type: 'expense',
    description: 'Material de escritório',
    amount: 85,
    date: '21/08/2025',
    category: 'Materiais',
  },
];