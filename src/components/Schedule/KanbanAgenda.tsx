// src/components/Schedule/KanbanAgenda.tsx
import React, { useMemo } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import SlotCard from './SlotCard';
import { AppointmentSlot, AppointmentJourney } from '../../types';

type Pro = { id: string; name: string; [k: string]: any };

type Props = {
  professionals: Pro[];
  journeys: AppointmentJourney[];
  slots: AppointmentSlot[];

  onSchedulePatient: (slotId: string) => void;
  onEditPatient: (slotId: string) => void;
  onStartAppointment: (slotId: string) => void;
  onFinishAppointment: (slotId: string) => void;
  onCancel: (slotId: string) => void;
  onNoShow: (slotId: string) => void;

  onEditJourney: (journeyId: string) => void;
  onDeleteJourney: (journeyId: string) => void;

  sortSlotsByTime: (
    a: { id: string; date: string; startTime: string; endTime: string },
    b: { id: string; date: string; startTime: string; endTime: string }
  ) => number;
};

const TITLE_BY_CODE: Record<string, string> = {
  CRM: 'Médicos',
  CRP: 'Psicólogos',
  COREN: 'Enfermagem',
  CREF: 'Educação Física',
  CREFITO: 'Fisioterapeutas',
  CRO: 'Odontologia',
  CRF: 'Farmacêuticos',
  CRN: 'Nutricionistas',
  CREA: 'Engenharia',
  CRFA: 'Fonoaudiólogos',
};

function extractCodeFromString(s?: string): string {
  if (!s) return '';
  const m = s.match(/[A-Za-z]{2,7}/);
  return (m?.[0] || '').toUpperCase();
}
function codeFromProfessional(p: Pro): string {
  if (!p) return '';
  const candidates: any[] = [
    p.registration, p.registry, p.register, p.register1, p.register2,
    p.registry1, p.registry2, p.document, p.document2,
    p.registration_type, p.registrationType, p.registerType, p.registryType,
    p.registrySigla, p.registrationSigla, p.regCode, p.regcode,
    p.professionalRegistration, p.professional_register,
    p.registrationPreview, p.registryPreview, p.registro, p.registroProf,
  ];
  for (const c of candidates) {
    const code = extractCodeFromString(typeof c === 'string' ? c : undefined);
    if (code && TITLE_BY_CODE[code]) return code;
  }
  for (const k of Object.keys(p)) {
    const v = (p as any)[k];
    if (typeof v === 'string') {
      const code = extractCodeFromString(v);
      if (code && TITLE_BY_CODE[code]) return code;
    }
  }
  const spec = (p.specialty || p.especialidade || p.especialidade2 || '').toString().toLowerCase();
  if (spec.includes('psico')) return 'CRP';
  if (spec.includes('médico') || spec.includes('medico')) return 'CRM';
  if (spec.includes('enferm')) return 'COREN';
  if (spec.includes('fisio')) return 'CREFITO';
  if (spec.includes('odonto') || spec.includes('dent')) return 'CRO';
  if (spec.includes('farmac')) return 'CRF';
  if (spec.includes('nutri')) return 'CRN';
  return '';
}

const KanbanAgenda: React.FC<Props> = ({
  professionals, journeys, slots,
  onSchedulePatient, onEditPatient, onStartAppointment, onFinishAppointment, onCancel, onNoShow,
  onEditJourney, onDeleteJourney, sortSlotsByTime,
}) => {
  const proById = useMemo(() => {
    const m = new Map<string, Pro>();
    for (const p of professionals) m.set(p.id, p);
    return m;
  }, [professionals]);

  const groups = useMemo(() => {
    type J = AppointmentJourney & { pro?: Pro; regTitle: string };
    const list: J[] = [];

    for (const j of journeys) {
      if (!slots.some(s => s.journeyId === j.id)) continue;
      const pro = j.professionalId ? proById.get(j.professionalId) : undefined;
      const code = codeFromProfessional(pro as Pro);
      const regTitle = TITLE_BY_CODE[code] || 'Outros Profissionais';
      list.push({ ...(j as any), pro, regTitle });
    }

    const map = new Map<string, J[]>();
    for (const j of list) {
      if (!map.has(j.regTitle)) map.set(j.regTitle, []);
      map.get(j.regTitle)!.push(j);
    }

    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const da = new Date(`${a.date}T${a.startTime}:00`);
        const db = new Date(`${b.date}T${b.startTime}:00`);
        return da.getTime() - db.getTime();
      });
    }

    return Array.from(map.entries()).map(([title, arr]) => ({ title, journeys: arr }));
  }, [journeys, slots, proById]);

  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <section key={gi} className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base md:text-lg font-semibold text-gray-900">{g.title}</h3>
              <div className="text-xs md:text-sm text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded">
                {g.journeys.reduce(
                  (acc, j) => acc + slots.filter(s => s.journeyId === j.id).length,
                  0
                )}{' '}
                horários
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {g.journeys.map((j) => {
              const js = slots.filter(s => s.journeyId === j.id).sort(sortSlotsByTime);

              // >>> DATA (apenas data, sem horários)
              const formattedDate = new Date(`${j.date}T12:00:00`).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              });

              return (
                <div key={j.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {j.pro?.name || j.professionalName || 'Profissional'}
                      </div>
                      {/* chip de data (mantido) */}
                      <span className="mt-1 inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-0.5 capitalize">
                        {formattedDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onEditJourney(j.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar jornada"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteJourney(j.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir jornada"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {js.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        onSchedulePatient={onSchedulePatient}
                        onEditPatient={onEditPatient}
                        onStartAppointment={onStartAppointment}
                        onFinishAppointment={onFinishAppointment}
                        onCancelAppointment={onCancel}
                        onMarkNoShow={onNoShow}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          Nenhum horário encontrado para o período/filtro selecionado.
        </div>
      )}
    </div>
  );
};

export default KanbanAgenda;
