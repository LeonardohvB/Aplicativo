// src/components/Schedule/KanbanAgenda.tsx
import React, { useMemo, useState } from 'react';
import { Edit2 as Edit, Trash2 } from 'lucide-react';
import SlotCard from './SlotCard';
import { AppointmentSlot, AppointmentJourney } from '../../types';

type Pro = {
  id: string;
  name: string;
  specialty?: string;
  registrationType?: string;
  registration?: string;
  registryType?: string;
  document?: string;
  documentType?: string;
  reg_type?: string;
};

const toLocalISO = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const fmtDateLong = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/* =================== Categorização =================== */
const REGISTRY_CATEGORY: Record<string, { label: string; order: number }> = {
  CRM: { label: 'Médicos', order: 1 },
  CRP: { label: 'Psicólogos', order: 2 },
  CRO: { label: 'Dentistas', order: 3 },
  COREN: { label: 'Enfermeiros', order: 4 },
  CREFITO: { label: 'Fisioterapeutas / TO', order: 5 },
  CRF: { label: 'Farmacêuticos', order: 6 },
  CRFA: { label: 'Fonoaudiólogos', order: 7 },
  CRN: { label: 'Nutricionistas', order: 8 },
  CREF: { label: 'Prof. Ed. Física', order: 9 },
  CRESS: { label: 'Assistentes Sociais', order: 10 },
  CREA: { label: 'Engenharia (CREA)', order: 99 },
};

const KNOWN_CODES = Object.keys(REGISTRY_CATEGORY);

/** extrai só a sigla (ex.: "CRP" de "CRP - 26465 / SP") */
function normalizeSigla(input?: string): string | undefined {
  if (!input) return undefined;
  const m = input.toUpperCase().match(/[A-Z]+/);
  return m?.[0];
}

/** tenta achar a sigla varrendo todos os campos string do profissional */
function getRegistrySigla(pro?: Pro): string | undefined {
  if (!pro) return undefined;

  // 1) candidatos diretos
  const directCandidates = [
    pro.registrationType,
    pro.registryType,
    pro.reg_type,
    pro.documentType,
    pro.document,
    pro.registration,
  ]
    .map(normalizeSigla)
    .filter(Boolean) as string[];

  for (const sig of directCandidates) {
    if (KNOWN_CODES.includes(sig)) return sig;
  }

  // 2) varre quaisquer campos string do objeto
  for (const [, v] of Object.entries(pro)) {
    if (typeof v === 'string') {
      const sig = normalizeSigla(v);
      if (sig && KNOWN_CODES.includes(sig)) return sig;
    }
  }

  return undefined;
}

function typeToCategory(sigla?: string, specialty?: string): { key: string; label: string } {
  if (sigla && REGISTRY_CATEGORY[sigla]) {
    return { key: sigla, label: REGISTRY_CATEGORY[sigla].label };
  }

  const sp = (specialty || '').toLowerCase();
  if (/psicol/.test(sp)) return { key: 'CRP', label: REGISTRY_CATEGORY.CRP.label };
  if (/m[eé]dic/.test(sp)) return { key: 'CRM', label: REGISTRY_CATEGORY.CRM.label };
  if (/odont|dent/.test(sp)) return { key: 'CRO', label: REGISTRY_CATEGORY.CRO.label };
  if (/enferm/.test(sp)) return { key: 'COREN', label: REGISTRY_CATEGORY.COREN.label };
  if (/fisiot|terapia ocup/.test(sp)) return { key: 'CREFITO', label: REGISTRY_CATEGORY.CREFITO.label };
  if (/farmac/.test(sp)) return { key: 'CRF', label: REGISTRY_CATEGORY.CRF.label };
  if (/fono/.test(sp)) return { key: 'CRFA', label: REGISTRY_CATEGORY.CRFA.label };
  if (/nutric/.test(sp)) return { key: 'CRN', label: REGISTRY_CATEGORY.CRN.label };
  if (/educa(ç|c)[aã]o f(í|i)s|ed\.?\s*f(í|i)s/.test(sp)) return { key: 'CREF', label: REGISTRY_CATEGORY.CREF.label };
  if (/servi[cç]o social|assistente social/.test(sp))
    return { key: 'CRESS', label: REGISTRY_CATEGORY.CRESS.label };

  return { key: 'OUTROS', label: 'Outros Profissionais' };
}

function resolveCategory(pro?: Pro): { key: string; label: string } {
  if (!pro) return { key: 'OUTROS', label: 'Outros Profissionais' };
  const sigla = getRegistrySigla(pro);
  return typeToCategory(sigla, pro.specialty);
}

/* =================== Toolbar (busca + dias) =================== */
type ToolbarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  activeDay: string;
  onDayChange: (d: string) => void;
  days: string[];
};
const Toolbar: React.FC<ToolbarProps> = ({ query, onQueryChange, activeDay, onDayChange, days }) => {
  return (
    <div className="mb-4 space-y-3">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar profissional ou especialidade..."
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00`);
          const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
          const dd = String(dt.getDate()).padStart(2, '0');
          return (
            <button
              key={d}
              onClick={() => onDayChange(d)}
              className={[
                'min-w-[64px] rounded-xl px-3 py-2 text-center border',
                d === activeDay ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 border-gray-200',
              ].join(' ')}
            >
              <div className="text-[11px] opacity-90">{wd}</div>
              <div className="text-base font-semibold">{dd}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* =================== Componente principal =================== */
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

const KanbanAgenda: React.FC<Props> = ({
  professionals,
  journeys,
  slots,
  onSchedulePatient,
  onEditPatient,
  onStartAppointment,
  onFinishAppointment,
  onCancel,
  onNoShow,
  onEditJourney,
  onDeleteJourney,
  sortSlotsByTime,
}) => {
  const [query, setQuery] = useState('');
  const today = toLocalISO(new Date());
  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      arr.push(toLocalISO(d));
    }
    return arr;
  }, []);
  const [activeDay, setActiveDay] = useState<string>(today);

  const proById = useMemo(() => {
    const m = new Map<string, Pro>();
    professionals.forEach((p) => m.set(p.id, p));
    return m;
  }, [professionals]);

  const jById = useMemo(() => {
    const m = new Map<string, AppointmentJourney>();
    journeys.forEach((j) => m.set(j.id, j));
    return m;
  }, [journeys]);

  const daySlots = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filterByQuery = (p?: Pro) => {
      if (!normalizedQuery) return true;
      const hay = [
        p?.name ?? '',
        p?.specialty ?? '',
        p?.registrationType ??
          p?.registryType ??
          p?.reg_type ??
          p?.documentType ??
          p?.document ??
          p?.registration ??
          '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(normalizedQuery);
    };

    return slots
      .filter((s) => s.date === activeDay)
      .filter((s) => filterByQuery(proById.get(jById.get(s.journeyId || '')?.professionalId || '')))
      .sort(sortSlotsByTime);
  }, [slots, activeDay, query, proById, jById, sortSlotsByTime]);

  const sections = useMemo(() => {
    type SlotGroup = { pro: Pro | undefined; journey: AppointmentJourney | undefined; slots: AppointmentSlot[] };
    const byPro = new Map<string, SlotGroup>();

    for (const s of daySlots) {
      const j = jById.get(s.journeyId || '');
      const pid = j?.professionalId || '';
      const key = pid || `__np__:${j?.id || s.id}`;
      if (!byPro.has(key)) byPro.set(key, { pro: proById.get(pid), journey: j, slots: [] });
      byPro.get(key)!.slots.push(s);
    }

    const byCat = new Map<string, { label: string; items: SlotGroup[] }>();
    for (const g of byPro.values()) {
      const cat = resolveCategory(g.pro);
      if (!byCat.has(cat.key)) byCat.set(cat.key, { label: cat.label, items: [] });
      byCat.get(cat.key)!.items.push(g);
    }

    for (const v of byCat.values()) {
      v.items.sort((a, b) => (a.pro?.name || '').localeCompare(b.pro?.name || '', 'pt-BR'));
      v.items.forEach((it) => it.slots.sort(sortSlotsByTime));
    }

    return Array.from(byCat.entries())
      .sort((a, b) => {
        const aOrder = REGISTRY_CATEGORY[a[0]]?.order ?? 1000;
        const bOrder = REGISTRY_CATEGORY[b[0]]?.order ?? 1000;
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aLabel = REGISTRY_CATEGORY[a[0]]?.label ?? a[1].label;
        const bLabel = REGISTRY_CATEGORY[b[0]]?.label ?? b[1].label;
        return aLabel.localeCompare(bLabel, 'pt-BR');
      })
      .map(([key, val]) => ({
        key,
        label: REGISTRY_CATEGORY[key]?.label ?? val.label,
        groups: val.items,
      }));
  }, [daySlots, jById, proById, sortSlotsByTime]);

  return (
    <div className="space-y-4">
      <Toolbar query={query} onQueryChange={setQuery} activeDay={activeDay} onDayChange={setActiveDay} days={days} />

      {sections.length === 0 && (
        <div className="text-center text-gray-500 py-16">Nenhum horário para o dia selecionado.</div>
      )}

      {sections.map((section) => {
        const total = section.groups.reduce((s, g) => s + g.slots.length, 0);
        return (
          <div key={section.key} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-gray-900 font-semibold">{section.label}</div>
                <div className="text-xs text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded mt-1">
                  {total} {total === 1 ? 'horário' : 'horários'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {section.groups.map((g, idx) => {
                const pro = g.pro;
                const j = g.journey;
                const dateLabel = j ? fmtDateLong(j.date) : fmtDateLong(activeDay);

                return (
                  <div key={idx} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{pro?.name || 'Profissional'}</div>
                        <div className="text-xs text-gray-500">{dateLabel}</div>
                      </div>
                      {j && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEditJourney(j.id)}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Editar jornada"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteJourney(j.id)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                            title="Excluir jornada"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {g.slots.map((s) => (
                        <SlotCard
                          key={s.id}
                          slot={s}
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
          </div>
        );
      })}
    </div>
  );
};

export default KanbanAgenda;
