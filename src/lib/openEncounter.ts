// src/lib/openEncounter.ts
export type EncounterOpenDetail = {
  appointmentId: string;              // id do agendamento/histórico
  patientName?: string;
  professionalName?: string;
  serviceName?: string;
};

export function openEncounter(detail: EncounterOpenDetail) {
  window.dispatchEvent(new CustomEvent('encounter:open', { detail }));
}
