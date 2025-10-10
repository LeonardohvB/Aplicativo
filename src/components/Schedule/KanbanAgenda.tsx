// src/components/Schedule/KanbanAgenda.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  Edit2 as Edit,
  Trash2,
  MapPin,
  BadgeCheck,
  Star,
  Video,
  Clock,
  Play as StartIcon,
  StopCircle as StopIcon,
  XCircle as CancelIcon,
  Phone,
  FileText,
} from 'lucide-react';
import { AppointmentSlot, AppointmentJourney } from '../../types';
import { publicUrlFromPath } from '../../lib/avatars';

// >>> usa o ConfirmDialog PADRÃO do app (o mesmo do Profile)
import ConfirmDialog from '../ui/ConfirmDialog';

/* ======================= Tipos utilitários ======================= */
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
  registrationCode?: string;

  avatar?: string | null;
  avatar_path?: string | null;
  avatarUpdatedAt?: string | null;
  avatar_updated_at?: string | null;

  avatarUrl?: string | null;
  photoUrl?: string | null;

  address?: string;
  rating?: number;
  reviewsCount?: number;
};

type Maybe<T> = T | undefined | null;

/* ======================= Helpers ======================= */
const toLocalISO = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const normISO = (s?: string) => String(s || '').slice(0, 10);

const fmtDateLong = (iso: string) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return iso;
  }
};

const isHHMM = (s?: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ''));
const safeHHMM = (s?: string, fb = '00:00') => (isHHMM(s) ? String(s) : fb);
const hhmmToMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmmToMinSafe = (hhmm?: string, fb = 0) =>
  (isHHMM(hhmm) ? hhmmToMin(String(hhmm)) : fb);

const SOON_BEFORE_MIN = 20;
const SOON_AFTER_MIN = 10;

const onlyDigits = (v?: string) => String(v || '').replace(/\D+/g, '');
const maskPhone = (v?: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

/* ======== Avatar helpers ======== */
const placeholder = 'https://placehold.co/96x96?text=Foto';
const withCacheBust = (url: string, v?: string | null) =>
  v ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}` : url;

function toDisplayUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return publicUrlFromPath(trimmed) || null;
}
function resolveProAvatarBaseUrl(p?: Pro): string {
  if (!p) return placeholder;
  const direct = toDisplayUrl(p.avatarUrl || p.photoUrl || undefined);
  const camel = toDisplayUrl(p.avatar || undefined);
  const snake = toDisplayUrl(p.avatar_path || undefined);
  return direct || camel || snake || placeholder;
}
function resolveProAvatarVersion(p?: Pro): string | undefined {
  if (!p) return undefined;
  return (p.avatarUpdatedAt as any) ?? (p.avatar_updated_at as any) ?? undefined;
}

const extractRegPrefix = (v?: string) => {
  if (!v) return '';
  const raw = String(v).toUpperCase().trim();
  const fromDash = raw.split(' - ')[0]?.trim();
  const m = (fromDash || raw).match(/[A-ZÀ-Ü]{2,6}/);
  return (m?.[0] || fromDash || '').normalize('NFD').replace(/\p{Diacritic}/gu, '');
};

function typeToCategory(raw?: string, specialty?: string): { key: string; label: string } {
  const s = extractRegPrefix(raw);
  const direct: Record<string, string> = {
    CRM: 'Médicos',
    CRP: 'Psicólogos',
    COREN: 'Enfermeiros',
    CREFITO: 'Fisioterapeutas',
    CRO: 'Dentistas',
    CRF: 'Farmacêuticos',
    CRN: 'Nutricionistas',
    CRESS: 'Assistentes Sociais',
    CREF: 'Prof. Ed. Física',
    CREA: 'Engenharia',
  };
  if (direct[s]) return { key: s, label: direct[s] };
  const sp = (specialty || '').toLowerCase();
  if (/psicol/.test(sp)) return { key: 'CRP', label: 'Psicólogos' };
  if (/m[eé]dic/.test(sp)) return { key: 'CRM', label: 'Médicos' };
  return { key: 'OUTROS', label: 'Outros Profissionais' };
}
function resolveCategory(pro?: Pro): { key: string; label: string } {
  if (!pro) return { key: 'OUTROS', label: 'Outros Profissionais' };
  const guess =
    pro.registrationCode ||
    pro.registrationType ||
    pro.registryType ||
    pro.reg_type ||
    pro.documentType ||
    pro.document ||
    pro.registration;
  return typeToCategory(guess, pro.specialty);
}

/* ======================= Toolbar ======================= */
type ToolbarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  activeDay: string;
  onDayChange: (d: string) => void;
  days: string[];
  prosCount: number;
};
const Toolbar: React.FC<ToolbarProps> = ({
  query,
  onQueryChange,
  activeDay,
  onDayChange,
  days,
  prosCount,
}) => (
  <div className="mb-4 space-y-3">
    <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-gray-400">🔎</span>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar profissional..."
        className="w-full bg-transparent text-[15px] outline-none placeholder:text-gray-400"
      />
    </div>
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {days.map((d) => {
        const dt = new Date(`${d}T12:00:00`);
        const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
        const dd = String(dt.getDate()).padStart(2, '0');
        const active = d === activeDay;
        return (
          <button
            key={d}
            onClick={() => onDayChange(d)}
            className={[
              'min-w-[66px] rounded-2xl px-3 py-2 text-center border shadow-sm transition-colors',
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            <div className="text-[11px] opacity-90">{wd}</div>
            <div className="text-[15px] font-semibold leading-none">{dd}</div>
          </button>
        );
      })}
    </div>
    <div className="text-sm text-gray-600">
  {prosCount} {prosCount === 1 ? 'profissional disponível' : 'profissionais disponíveis'}
</div>

  </div>
);

/* ======================= Slot Card ======================= */
type MiniSlotProps = {
  slot: AppointmentSlot;
  isPast: boolean;
  isSoon: boolean;
  isRunning: boolean;
  elapsedMin?: number;
  onSchedule: (slotId: string) => void;
  onEdit: (slotId: string) => void;
  onStart?: (slotId: string) => void;
  onFinish: (slotId: string) => void;
  onCancel?: (slotId: string) => void;
  onNoShow?: (slotId: string) => void;
  onDelete: () => void;
  professionalName?: string;
};

const MiniSlotCard: React.FC<MiniSlotProps> = ({
  slot,
  isPast,
  isSoon,
  isRunning,
  elapsedMin,
  onSchedule,
  onEdit,
  onStart,
  onFinish,
  onCancel,
  onNoShow,
  onDelete,
  professionalName,
}) => {
  const st = String(slot?.status || '').toLowerCase();
  const startTime = safeHHMM(slot?.startTime, '00:00');
  const endTime = safeHHMM(slot?.endTime, startTime);
  const mins = Math.max(15, hhmmToMinSafe(endTime) - hhmmToMinSafe(startTime));

  const isAvailable = st === 'disponivel' || st === 'available' || st === '';
  const isEditing = st === 'agendado';

  const patientObj: Maybe<{ name?: string; phone?: string; document?: string; documentNumber?: string }> =
    (slot as any)?.patient || null;

  const patientName =
    (slot as any)?.patientName ||
    patientObj?.name ||
    (slot as any)?.patient_name ||
    '';

  const patientPhone =
    (slot as any)?.patientPhone ||
    (slot as any)?.patient_phone ||
    patientObj?.phone ||
    '';

  const openEncounterFromSlot = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('encounter:open', {
        detail: {
          appointmentId: slot.id,
          patientName: patientName || (slot as any)?.patient?.name,
          professionalName: professionalName || 'Profissional',
          serviceName: (slot as any).service || 'Consulta',
        },
      })
    );
  }, [slot, patientName, professionalName]);

  const wClass = isEditing || isRunning ? 'w-[280px]' : 'w-[160px]';
  const cardH = isEditing || isRunning ? 'h-[180px]' : 'h-[116px]';

  let onCardClick: (() => void) | undefined;
  if (!isPast && !isRunning) {
    if (isAvailable) onCardClick = () => onSchedule(slot.id);
    else if (isEditing) onCardClick = () => onEdit(slot.id);
  }

  const isRemote = /online|on-line|tele|vídeo|video|remoto/i.test(String(slot?.service || ''));
  const ModeIcon = isRemote ? Video : MapPin;

  const stateBorder = isRunning
    ? 'border-sky-300'
    : isPast
    ? 'border-gray-200'
    : isEditing
    ? 'border-emerald-300'
    : 'border-emerald-300';
  const stateBg = isRunning
    ? 'bg-sky-50'
    : isPast
    ? 'bg-gray-100'
    : isEditing
    ? 'bg-emerald-50'
    : 'bg-emerald-50';

  return (
    <div className={`snap-start flex-shrink-0 ${wClass}`}>
      <div
        role={onCardClick ? 'button' : undefined}
        tabIndex={onCardClick ? 0 : undefined}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (!onCardClick) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick();
          }
        }}
        className={[
          'relative rounded-xl border px-3 py-2 transition w-full text-left',
          'animate-[toast-in_0.18s_ease-out]', // ← mesmo timing do Toast
          cardH,
          stateBg,
          stateBorder,
          onCardClick ? 'hover:shadow-sm cursor-pointer' : 'opacity-90',
          'focus-visible:outline-none focus-visible:ring-0',
          isPast && !onCardClick ? 'cursor-not-allowed' : '',
        ].join(' ')}
        style={{ transformOrigin: 'top left' }}
        aria-label="slot"
      >
        {/* header */}
        <div className="absolute left-2 top-2 text-gray-700">
          <ModeIcon className="w-3.5 h-3.5" />
        </div>
        <div
          className="absolute right-2 top-2 text-[11px] text-gray-600 flex items-center gap-1 tabular-nums"
          title={`${startTime} - ${endTime}`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{startTime} - {endTime}</span>
        </div>

        {/* corpo */}
        <div
          className={`h-full ${
            isEditing || isRunning ? 'pt-2 pb-8' : 'pt-4 pb-7'
          } flex flex-col items-stretch justify-center`}
        >
          {isAvailable && !isRunning && (
            <div className="text-center">
              <div className="text-[16px] font-semibold leading-none text-gray-900 tabular-nums">
                {(Number(slot?.price) || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 0,
                })}
              </div>
            </div>
          )}

          {!isAvailable && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-[4px] rounded-lg bg-white/70 border border-emerald-200 overflow-hidden">
                <span className="text-[12px] text-gray-600 shrink-0">Paciente:</span>
                <span className="text-[12px] font-medium text-gray-800 truncate" title={patientName}>
                  {patientName || '—'}
                </span>
              </div>

              {isRunning && (
                <div className="grid grid-cols-1 gap-1">
                  <div className="flex items-center gap-2 px-2 py-[3px] rounded-lg bg-white/60 border border-sky-200">
                    <Phone className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-[12px] text-gray-700 truncate">
                      {maskPhone(patientPhone) || '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* rodapé / cronômetro */}
        {!isRunning ? (
          <div className="absolute bottom-2 left-2 text-[10px] text-gray-600 tabular-nums">
            {mins}min
          </div>
        ) : (
          <div className="absolute bottom-2 left-2 px-2 py-[2px] rounded-full text-[10px] font-semibold text-sky-800 bg-sky-100 border border-sky-200">
            ⏱ {Math.max(0, elapsedMin ?? 0)}min
          </div>
        )}

        {/* ações em atendimento */}
        {isRunning && (
          <div className="absolute bottom-1 right-1 flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEncounterFromSlot();
              }}
              className="px-3 py-[6px] rounded-full border border-gray-300 text-gray-800 bg-white hover:bg-gray-50 text-[11px] font-semibold"
              title="Abrir prontuário"
              aria-label="Prontuário"
            >
              <span className="inline-flex items-center gap-1">
                <StartIcon className="w-3.5 h-3.5" /> Prontuário
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFinish(slot.id); // ← agora abre o modal (wrapper no Kanban)
              }}
              className="px-3 py-[6px] rounded-full bg-red-600 text-white hover:bg-red-700 text-[11px] font-semibold"
              title="Finalizar consulta"
              aria-label="Finalizar"
            >
              <span className="inline-flex items-center gap-1">
                <StopIcon className="w-3.5 h-3.5" /> Finalizar
              </span>
            </button>
          </div>
        )}

        {/* ações para horários livres/passados */}
        {!isRunning && isAvailable && (
          <div className="absolute bottom-1 right-1 flex gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(slot.id);
              }}
              className="p-1 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50"
              title="Editar horário"
              aria-label="Editar"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50"
              title="Excluir horário"
              aria-label="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ações abaixo do card (agendado e ainda não iniciado) */}
      {!isRunning && !isAvailable && (() => {
        const showNoShow = isPast;
        return (
          <div className={`mt-2 grid gap-2 ${showNoShow ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => {
                openEncounterFromSlot();
                (onStart ?? onEdit)(slot.id);
              }}
              disabled={!isSoon}
              className={[
                'px-3 py-2 rounded-full text-[12px] font-medium border inline-flex items-center justify-center gap-1',
                isSoon
                  ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                  : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed',
              ].join(' ')}
              title={isSoon ? 'Começar consulta' : 'Disponível 20min antes'}
            >
              <StartIcon className="w-4 h-4" /> Começar
            </button>

            {showNoShow && (
              <button
                type="button"
                onClick={() => onNoShow?.(slot.id)}
                className="px-3 py-2 rounded-full text-[12px] font-medium border border-orange-300 text-orange-800 bg-orange-50 hover:bg-orange-100 inline-flex items-center justify-center gap-1"
                title="Marcar paciente como faltou"
                aria-label="Faltou"
              >
                <CancelIcon className="w-4 h-4" /> Faltou
              </button>
            )}

            <button
              type="button"
              onClick={() => (onCancel ? onCancel(slot.id) : onDelete())}
              className="px-3 py-2 rounded-full text-[12px] font-medium border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 inline-flex items-center justify-center gap-1"
              title="Cancelar agendamento"
            >
              <CancelIcon className="w-4 h-4" /> Cancelar
            </button>
          </div>
        );
      })()}
    </div>
  );
};

/* ======================= Kanban ======================= */
type Props = {
  professionals?: Pro[];
  journeys?: AppointmentJourney[];
  slots?: AppointmentSlot[];
  onSchedulePatient: (slotId: string) => void;
  onEditPatient: (slotId: string) => void;
  onFinishAppointment: (slotId: string) => void;
  onStartAppointment?: (slotId: string) => void;
  onCancel?: (slotId: string) => void;
  onNoShow?: (slotId: string) => void;
  onEditJourney: (journeyId: string) => void;
  onDeleteJourney: (journeyId: string) => void;
  sortSlotsByTime?: (
    a: { id: string; date: string; startTime: string; endTime: string },
    b: { id: string; date: string; startTime: string; endTime: string }
  ) => number;
};

const KanbanAgenda: React.FC<Props> = ({
  professionals = [],
  journeys = [],
  slots = [],
  onSchedulePatient,
  onEditPatient,
  onStartAppointment,
  onCancel,
  onNoShow,
  onEditJourney,
  onDeleteJourney,
  sortSlotsByTime,
}) => {
  const [query, setQuery] = useState('');
  const [days, setDays] = useState<string[]>([]);
  const [activeDay, setActiveDay] = useState<string>('');
  const [, setTick] = useState<number>(Date.now());

  // startedAt local para cronômetro
  const [startedAtMap, setStartedAtMap] = useState<Record<string, number>>({});

  // === estado do modal de finalizar ===
  const [slotIdToFinish, setSlotIdToFinish] = useState<string | null>(null);
  const askFinish = (slotId: string) => setSlotIdToFinish(slotId);

  useEffect(() => {
    const now = new Date();
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      arr.push(d.toISOString().slice(0, 10));
    }
    setDays(arr);
    setActiveDay((prev) => prev || arr[0]);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const defaultSort =
    sortSlotsByTime ||
    ((a, b) => {
      const da = normISO(a.date);
      const db = normISO(b.date);
      if (da !== db) return da.localeCompare(db);
      return hhmmToMinSafe(a.startTime) - hhmmToMinSafe(b.startTime);
    });

  const proById = useMemo(() => {
    const m = new Map<string, Pro>();
    professionals.forEach((p) => p?.id && m.set(p.id, p));
    return m;
  }, [professionals]);

  const jById = useMemo(() => {
    const m = new Map<string, AppointmentJourney>();
    journeys.forEach((j) => j?.id && m.set(j.id, j));
    return m;
  }, [journeys]);

  const daySlots = useMemo(() => {
    if (!activeDay) return [] as AppointmentSlot[];
    const q = query.trim().toLowerCase();

    const filterByQuery = (p?: Pro) => {
      if (!q) return true;
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
      return hay.includes(q);
    };

    return (slots || [])
      .filter((s) => normISO(s?.date) === activeDay)
      .filter((s) => {
        const proId = jById.get(String(s?.journeyId || ''))?.professionalId || '';
        return filterByQuery(proById.get(proId));
      })
      .sort(defaultSort);
  }, [slots, activeDay, query, proById, jById, defaultSort]);

  const sections = useMemo(() => {
    type SlotGroup = {
      pro?: Pro;
      journey?: AppointmentJourney;
      slots: AppointmentSlot[];
    };
    const byPro = new Map<string, SlotGroup>();
    for (const s of daySlots) {
      const j = jById.get(String(s?.journeyId || ''));
      const pid = j?.professionalId || '';
      const key = pid || `__np__:${j?.id || s.id}`;
      if (!byPro.has(key))
        byPro.set(key, { pro: proById.get(pid), journey: j, slots: [] });
      byPro.get(key)!.slots.push(s);
    }
    const byCat = new Map<string, { label: string; items: SlotGroup[] }>();
    for (const group of byPro.values()) {
      const cat = resolveCategory(group.pro);
      const entry = byCat.get(cat.key) ?? { label: cat.label, items: [] };
      entry.items.push(group);
      byCat.set(cat.key, entry);
    }
    for (const entry of byCat.values()) {
      entry.items.sort((a, b) =>
        (a.pro?.name || '').localeCompare(b.pro?.name || '', 'pt-BR')
      );
      entry.items.forEach((it) => it.slots.sort(defaultSort));
    }
    const order = ['CRP', 'CRM'];
    return Array.from(byCat.entries())
      .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        if (ia === -1 && ib === -1)
          return a[1].label.localeCompare(b[1].label, 'pt-BR');
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
      .map(([key, val]) => ({ key, label: val.label, groups: val.items }));
  }, [daySlots, jById, proById, defaultSort]);

  const prosCountForDay = useMemo(
    () =>
      new Set(
        daySlots
          .map((s) => jById.get(String(s?.journeyId || ''))?.professionalId)
          .filter(Boolean)
      ).size,
    [daySlots, jById]
  );

  const handleStartLocal = (slotId: string) => {
    setStartedAtMap((m) => ({ ...m, [slotId]: Date.now() }));
    onStartAppointment?.(slotId);
  };

  const getElapsedMin = (s: AppointmentSlot) => {
    const apiStarted = (s as any)?.startedAt
      ? new Date((s as any).startedAt).getTime()
      : undefined;
    const localStarted = startedAtMap[s.id];
    const scheduled = new Date(
      `${s.date}T${safeHHMM(s.startTime)}:00`
    ).getTime();
    const startedTs = apiStarted ?? localStarted ?? scheduled;
    return Math.floor((Date.now() - startedTs) / 60000);
  };

  return (
    <div className="space-y-5">
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        activeDay={activeDay}
        onDayChange={setActiveDay}
        days={days}
        prosCount={prosCountForDay}
      />

      {sections.length === 0 && (
        <div className="text-center text-gray-500 py-16">
          Nenhum horário para o dia selecionado.
        </div>
      )}

      {sections.map((section) => {
        const total = section.groups.reduce((s, g) => s + g.slots.length, 0);
        return (
          <div
            key={section.key}
            className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-gray-900 font-semibold text-[15px]">
                {section.label}
              </div>
              <div className="text-xs text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded">
                {total} {total === 1 ? 'horário' : 'horários'}
              </div>
            </div>

            <div className="space-y-0">
              {section.groups.map((g, idx) => {
                const pro = g.pro;
                const j = g.journey;
                const dateLabel = fmtDateLong(normISO(j?.date) || toLocalISO(new Date()));
                const address = pro?.address;

                const availableCount = g.slots.filter((s) => {
                  const st = String(s?.status || '').toLowerCase().trim();
                  return st === '' || st === 'disponivel' || st === 'available';
                }).length;

                const baseAvatar = resolveProAvatarBaseUrl(pro);
                const version = resolveProAvatarVersion(pro);
                const avatar = withCacheBust(baseAvatar, version);

                const initials =
                  (pro?.name || 'P')
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase() || 'P';

                return (
                  <div
                    key={idx}
                    className="-mx-4 px-4 py-4 bg-transparent border-t border-gray-100 first:border-t-0"
                  >
                    {/* Cabeçalho do profissional */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={pro?.name || 'Profissional'}
                              className="w-12 h-12 rounded-full object-cover border"
                              onError={(e) => ((e.currentTarget as HTMLImageElement).src = placeholder)}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 grid place-items-center text-sm font-semibold text-gray-700">
                              {initials}
                            </div>
                          )}
                          {(pro?.registration ||
                            pro?.registrationType ||
                            pro?.registryType ||
                            pro?.document ||
                            pro?.documentType) && (
                            <BadgeCheck className="w-4 h-4 text-emerald-600 absolute -right-1 -bottom-1 bg-white rounded-full" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">
                            {pro?.name || 'Profissional'}
                          </div>
                          {pro?.specialty && (
                            <div className="text-sm text-gray-700 truncate">
                              {pro.specialty}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 capitalize truncate">
                            {dateLabel}
                          </div>
                          {(pro?.rating || pro?.reviewsCount) && (
                            <div className="mt-1 flex items-center gap-1 text-sm text-gray-700">
                              <Star className="w-4 h-4 text-amber-500" />
                              <span className="font-medium">
                                {(pro?.rating ?? 4.9).toFixed(1)}
                              </span>
                              {typeof pro?.reviewsCount === 'number' && (
                                <span className="text-gray-500">
                                  ({pro.reviewsCount})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {!!availableCount && (
                        <div className="ml-auto shrink-0 text-[11px] font-semibold text-orange-800 bg-orange-100 border border-orange-200 rounded-full px-2 py-[2px] leading-none whitespace-nowrap">
                          {availableCount} {availableCount === 1 ? 'vaga' : 'vagas'}
                        </div>
                      )}
                    </div>

                    {/* Carrossel de slots */}
                    <div className="mt-2 -mx-1 overflow-x-auto no-scrollbar">
                      <div className="flex items-stretch gap-3 px-1 pr-3 snap-x snap-mandatory">
                        {(g.slots || []).map((s) => {
                          const jId = s?.journeyId || j?.id;
                          const st = String(s?.status || '').toLowerCase();
                          const isAvailable =
                            st === 'disponivel' || st === 'available' || st === '';
                          const isRunning = st === 'em_andamento';

                          const slotDay = normISO(s?.date);
                          const startMin = hhmmToMinSafe(s?.startTime, 0);
                          const todayISO = toLocalISO(new Date());
                          const nowMin = hhmmToMin(
                            `${String(new Date().getHours()).padStart(2, '0')}:${String(
                              new Date().getMinutes()
                            ).padStart(2, '0')}`
                          );

                          const BLOCK_GRACE_MIN = 10;

                          const isPast =
                            slotDay < todayISO ||
                            (slotDay === todayISO && nowMin > startMin + BLOCK_GRACE_MIN);

                          const isSoon =
                            slotDay === todayISO &&
                            startMin - SOON_BEFORE_MIN <= nowMin &&
                            nowMin <= startMin + SOON_AFTER_MIN;

                          const elapsed = isRunning ? getElapsedMin(s) : undefined;

                          return (
                            <MiniSlotCard
                              key={s.id}
                              slot={s}
                              isPast={isPast}
                              isSoon={isSoon}
                              isRunning={isRunning}
                              elapsedMin={elapsed}
                              onSchedule={onSchedulePatient}
                              onEdit={() => {
                                if (isAvailable) {
                                  if (jId) onEditJourney(jId);
                                } else {
                                  onEditPatient(s.id);
                                }
                              }}
                              onStart={handleStartLocal}
                              onFinish={askFinish}               // ← wrapper abre modal
                              onCancel={onCancel}
                              onNoShow={onNoShow}
                              onDelete={() => {
                                if (jId) onDeleteJourney(jId);
                              }}
                              professionalName={pro?.name || 'Profissional'}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {address && (
                      <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="line-clamp-1">{address}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Modal de finalizar (central com zoom) */}
      <ConfirmDialog
        open={!!slotIdToFinish}
        onClose={() => setSlotIdToFinish(null)}
        onConfirm={() => {
          if (!slotIdToFinish) return;

          // pega o slot e metadados p/ abrir o prontuário
          const s = (slots || []).find(x => x.id === slotIdToFinish);
          if (!s) { setSlotIdToFinish(null); return; }

          const j = jById.get(String(s.journeyId || ''));
          const proName =
            proById.get(j?.professionalId || '')?.name || 'Profissional';
          const patientName =
            (s as any)?.patientName || (s as any)?.patient?.name || '';
          const serviceName = (s as any)?.service || 'Consulta';

          // abre o prontuário e já solicita finalizar sem novo confirm
          window.dispatchEvent(new CustomEvent('encounter:open', {
            detail: {
              appointmentId: s.id,
              patientName,
              professionalName: proName,
              serviceName,
              autoFinalize: true,   // ← chave p/ o LiveEncounter
            },
          }));

          setSlotIdToFinish(null);
        }}
        title="Finalizar este atendimento."
        description="Deseja também gerar a evolução agora?"
        confirmText="Sim"
        cancelText="Cancelar"
        icon={<FileText className="w-6 h-6" />}
      />
    </div>
  );
};

export default KanbanAgenda;
