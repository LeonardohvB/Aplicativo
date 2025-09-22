// src/pages/Reports.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Percent, Users, Calendar, DollarSign, CheckCircle, Download,
  CalendarDays, CalendarRange, Filter as FilterIcon, X, Phone, FileText, Search, LucideIcon
} from 'lucide-react';
import { useProfessionals } from '../hooks/useProfessionals';
import { useTransactions } from '../hooks/useTransactions';
import { useAppointmentHistory } from '../hooks/useAppointmentHistory';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { supabase } from '../lib/supabase';
import { pdf, Document, Page, Text, View, StyleSheet, Svg, Path, Rect } from '@react-pdf/renderer';
import ReportDocument, { Row as PdfRow } from '../ReportDocument';

/* ======================================================================
   Helpers (datas/formatos)
====================================================================== */
const toLocalISODate = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const todayLocalISO = () => toLocalISODate(new Date());
const fmtBR = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');
type RangeMode = 'day' | 'week' | 'month' | 'custom';
const periodLabelFor = (mode: RangeMode, from: string, to: string) => {
  if (mode === 'custom') return `${fmtBR(from)} a ${fmtBR(to)}`;
  if (mode === 'day') return 'Dia';
  if (mode === 'week') return 'Semana';
  if (mode === 'month') return 'Mês';
  return '';
};
const byOwner = <T extends Record<string, any>>(arr: T[], uid: string | null): T[] => {
  if (!uid || !Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  const hasOwner = arr.some(it => 'owner_id' in it);
  return hasOwner ? arr.filter(it => it.owner_id === uid) : arr;
};
const isIncome  = (t?: string) => (t ?? '').toLowerCase() === 'income';
const isExpense = (t?: string) => (t ?? '').toLowerCase() === 'expense';
const isDone    = (s?: string) => (s ?? '').toLowerCase() === 'concluido';
const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ======================================================================
   Mini input de data
====================================================================== */
const DateInput: React.FC<{label: string; value: string; onChange: (v: string) => void;}> = ({ label, value, onChange }) => (
  <div className="flex flex-col min-w-[160px] print:min-w-[200px]">
    <span className="text-xs text-gray-500 mb-1">{label}</span>
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pr-2.5 pl-8 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
);

/* ======================================================================
   PDF do Paciente (mantido)
====================================================================== */
type PatientVisit = {
  date: string;
  time: string;
  professional?: string;
  professionalSpecialty?: string | undefined;
  service?: string;
  price?: number | null;
};
const pdfStyles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 12, color: '#4B5563', marginBottom: 14 },
  cardRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10 },
  cardTitle: { fontSize: 9, color: '#6B7280', marginBottom: 4 },
  cardValue: { fontSize: 12, fontWeight: 700, color: '#111827' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#111827', color: '#FFFFFF', padding: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  th: { fontSize: 10, fontWeight: 700 },
  row: { flexDirection: 'row', padding: 8, borderBottomColor: '#E5E7EB', borderBottomWidth: 1 },
  colDate: { width: 70 },
  colTime: { width: 70 },
  colProf: { flex: 1 },
  colSvc: { flex: 1 },
  colVal: { width: 70, textAlign: 'right' },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  footer: { marginTop: 12, color: '#6B7280', fontSize: 9, textAlign: 'right' },
  chartWrap: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
});
const COLORS = ['#60A5FA','#34D399','#FBBF24','#F472B6','#A78BFA','#F87171','#10B981','#F59E0B','#818CF8','#2DD4BF'];
function polarToCartesian(cx:number, cy:number, r:number, angle:number){
  const a = (angle - 90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(a)), y: cy + (r * Math.sin(a)) };
}
function describeArc(cx:number, cy:number, r:number, startAngle:number, endAngle:number){
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}
const PatientPdfDocument: React.FC<{
  patientName: string; periodLabel: string; visits: PatientVisit[];
}> = ({ patientName, periodLabel, visits }) => {
  const total = visits.length;
  const totalValue = visits.reduce((s, v) => s + (Number(v.price) || 0), 0);
  const byProf = new Map<string, { name: string; spec?: string; value: number; count: number }>();
  for (const v of visits) {
    const name = v.professional || '—';
    const spec = v.professionalSpecialty;
    const key = `${name}#${spec ?? ''}`;
    if (!byProf.has(key)) byProf.set(key, { name, spec, value: 0, count: 0 });
    const x = byProf.get(key)!; x.value += Number(v.price) || 0; x.count += 1;
  }
  const entries = Array.from(byProf.values());
  const sum = entries.reduce((s, e) => s + e.value, 0) || 1;
  let cursor = 0; const radius = 42; const cx = 50, cy = 50;
  const slices = entries.map((e, i) => {
    const angle = (e.value / sum) * 360;
    const path = describeArc(cx, cy, radius, cursor, cursor + angle);
    const color = COLORS[i % COLORS.length];
    cursor += angle;
    return { path, color, label: `${e.name}${e.spec ? ` — ${e.spec}` : ''}`, value: e.value };
  });

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <Text style={pdfStyles.h1}>Relatório do Paciente</Text>
        <Text style={pdfStyles.h2}>{patientName} • Período: {periodLabel}</Text>
        <View style={pdfStyles.cardRow}>
          <View style={pdfStyles.card}><Text style={pdfStyles.cardTitle}>Atendimentos no período</Text><Text style={pdfStyles.cardValue}>{total}</Text></View>
          <View style={pdfStyles.card}><Text style={pdfStyles.cardTitle}>Valor total</Text><Text style={pdfStyles.cardValue}>{currency(totalValue)}</Text></View>
          <View style={pdfStyles.card}><Text style={pdfStyles.cardTitle}>Profissionais atendentes</Text><Text style={pdfStyles.cardValue}>{byProf.size}</Text></View>
        </View>
        <Text style={pdfStyles.sectionTitle}>Distribuição por Profissional (valor)</Text>
        <View style={pdfStyles.chartWrap}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            <Path d={describeArc(cx, cy, radius, 0, 359.999)} fill="#E5E7EB" />
            {slices.map((s, i) => (<Path key={i} d={s.path} fill={s.color} />))}
          </Svg>
          <View>
            {slices.map((s, i) => (
              <View key={i} style={pdfStyles.legendItem}>
                <Svg width={10} height={10}><Rect x={0} y={0} width={10} height={10} fill={s.color} /></Svg>
                <Text>{s.label} — {currency(s.value)}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={pdfStyles.tableHeader}>
          <View style={pdfStyles.colDate}><Text style={pdfStyles.th}>Data</Text></View>
          <View style={pdfStyles.colTime}><Text style={pdfStyles.th}>Horário</Text></View>
          <View style={pdfStyles.colProf}><Text style={pdfStyles.th}>Profissional</Text></View>
          <View style={pdfStyles.colSvc}><Text style={pdfStyles.th}>Serviço</Text></View>
          <View style={pdfStyles.colVal}><Text style={pdfStyles.th}>Valor</Text></View>
        </View>
        {visits.map((r, i) => (
          <View key={i} style={pdfStyles.row}>
            <View style={pdfStyles.colDate}><Text>{fmtBR(r.date)}</Text></View>
            <View style={pdfStyles.colTime}><Text>{r.time}</Text></View>
            <View style={pdfStyles.colProf}><Text>{r.professional || '—'}{r.professionalSpecialty ? ` — ${r.professionalSpecialty}` : ''}</Text></View>
            <View style={pdfStyles.colSvc}><Text>{r.service || '—'}</Text></View>
            <View style={pdfStyles.colVal}><Text>{r.price != null ? currency(r.price) : '—'}</Text></View>
          </View>
        ))}
        <Text style={pdfStyles.footer}>Gerado em {new Date().toLocaleString('pt-BR')}</Text>
      </Page>
    </Document>
  );
};

/* ======================================================================
   Modais de Pacientes
====================================================================== */
type PatientAgg = { name: string; phone?: string; count: number; lastDate: string; };

/* >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
   NOVO HELPER: abrevia nomes no formato:
   "Primeiro" + iniciais dos meios + (partícula do último, se houver) + "Último"
   Ex.: "Ana Beatriz dos Santos" -> "Ana B dos Santos"
        "João da Silva"          -> "João da Silva"
        "Leonardo Henrique Vieira Barros" -> "Leonardo H V Barros"
>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */
function abbreviateNamePT(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const particles = new Set(['de','da','das','do','dos','du',"d'",'d’','e']);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (parts.length === 1) return cap(parts[0]);

  // encontra último sobrenome (pula partículas no fim)
  let lastIdx = parts.length - 1;
  while (lastIdx > 0 && particles.has(parts[lastIdx].toLowerCase())) lastIdx--;

  // monta "partícula + Último" se a palavra anterior for partícula
  let last = cap(parts[lastIdx]);
  if (lastIdx - 1 >= 0 && particles.has(parts[lastIdx - 1].toLowerCase())) {
    last = parts[lastIdx - 1].toLowerCase() + ' ' + last;
  }

  const first = cap(parts[0]);

  // iniciais dos nomes do meio (entre primeiro e lastIdx), ignorando partículas
  const mids = parts.slice(1, lastIdx)
    .filter(p => !particles.has(p.toLowerCase()))
    .map(p => p[0].toUpperCase());

  return [first, ...mids, last].filter(Boolean).join(' ');
}

const PatientsModal: React.FC<{
  open: boolean; onClose: () => void; periodLabel: string; patients: PatientAgg[];
  onOpenPatient: (patientName: string) => void;
}> = ({ open, onClose, periodLabel, patients, onOpenPatient }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return patients;
    return patients.filter(p => p.name.toLowerCase().includes(t));
  }, [q, patients]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4">
      <div className="mt-10 w-full max-w-xl bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Pacientes ({periodLabel})</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>
        </div>

        <div className="max-h-[65vh] overflow-y-auto divide-y">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-500">Nenhum paciente encontrado.</div>
          ) : (
            filtered.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onOpenPatient(p.name)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50"
                title="Ver atendimentos do paciente"
              >
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="text-sm text-gray-600">
                  Último atendimento: {fmtBR(p.lastDate)} • {p.count} {p.count === 1 ? 'atendimento' : 'atendimentos'}
                </div>
                {p.phone && (
                  <div className="mt-1 text-sm text-gray-600 flex items-center gap-1.5">
                    <Phone size={14} /> {p.phone}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t text-sm text-gray-600 bg-gray-50">
          Total de pacientes únicos: <b>{filtered.length}</b>
        </div>
      </div>
    </div>
  );
};

const PatientDetailsModal: React.FC<{
  open: boolean; onClose: () => void; patientName: string; periodLabel: string; visits: PatientVisit[];
}> = ({ open, onClose, patientName, periodLabel, visits }) => {
  const total = visits.length;
  const totalValue = visits.reduce((s, v) => s + (Number(v.price) || 0), 0);

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; spec?: string; count: number; value: number }>();
    for (const v of visits) {
      const name = v.professional || '—';
      const spec = v.professionalSpecialty;
      const key = `${name}#${spec ?? ''}`;
      if (!m.has(key)) m.set(key, { name, spec, count: 0, value: 0 });
      const x = m.get(key)!; x.count += 1; x.value += Number(v.price) || 0;
    }
    return Array.from(m.values());
  }, [visits]);

  const handlePdf = async () => {
    const blob = await pdf(
      <PatientPdfDocument patientName={patientName} periodLabel={periodLabel} visits={visits} />
    ).toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `paciente_${patientName.replace(/\s+/g,'_')}_${periodLabel.replace(/\s+/g,'_')}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4">
      <div className="mt-10 w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">{patientName}</h3>
            <p className="text-xs text-gray-500">Período: {periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
              <FileText size={16} /> Exportar PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
          </div>
        </div>

        <div className="px-5 py-3 border-b grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-gray-500">Atendimentos</div>
            <div className="text-gray-900 font-semibold text-lg">{total}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-gray-500">Valor total</div>
            <div className="text-gray-900 font-semibold text-lg">{currency(totalValue)}</div>
          </div>
        </div>

        <div className="px-5 py-3 border-b">
          <div className="font-medium mb-2">Resumo por Profissional</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {grouped.map((g, i) => (
              <div key={i} className="rounded-md border border-gray-200 p-2 flex items-center justify-between">
                <span className="text-gray-800">
                  {g.name}{g.spec ? ` — ${g.spec}` : ''}
                </span>
                <span className="text-gray-600">
                  {g.count} • {currency(g.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {visits.map((v, i) => (
            <div key={i} className="px-5 py-3">
              <div className="text-sm text-gray-500">{fmtBR(v.date)} • {v.time}</div>
              <div className="font-medium text-gray-900">{v.professional || '—'}</div>
              {v.professionalSpecialty && (
                <div className="text-xs text-gray-500 -mt-0.5 mb-1">{v.professionalSpecialty}</div>
              )}
              <div className="text-sm text-gray-700">{v.service || '—'}</div>
              <div className="text-sm text-gray-900">{v.price != null ? currency(v.price) : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ======================================================================
   Hero Card (gradiente) com período + 3 KPIs
====================================================================== */
const Pill: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({ active, children, className, ...rest }) => (
  <button
    {...rest}
    className={[
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all",
      active ? "bg-white text-gray-900 border-white shadow" : "bg-white/10 text-white border-white/30 hover:bg-white/20"
    ].join(' ') + (className ? ` ${className}` : '')}
  >
    {children}
  </button>
);

const KpiTile: React.FC<{ title: string; value: string; icon: LucideIcon; }> = ({ title, value, icon: Icon }) => (
  <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-white/40 px-4 py-3">
    <div className="grid place-items-center rounded-lg p-2 bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  </div>
);

type HeroProps = {
  rangeMode: RangeMode;
  setRangeMode: (m: RangeMode) => void;
  from: string; to: string;
  setFrom: (v: string) => void; setTo: (v: string) => void;
  revenue: number; expenses: number; marginPct: string;
  onPdf: () => void;
};
const HeroReportsCard: React.FC<HeroProps> = ({
  rangeMode, setRangeMode, from, to, setFrom, setTo,
  revenue, expenses, marginPct, onPdf
}) => (
  <div className="rounded-3xl p-5 md:p-6 bg-gradient-to-br from-slate-900 to-indigo-900 text-white shadow-xl">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <div className="text-sm text-white/80">Período: <b>{periodLabelFor(rangeMode, from, to)}</b></div>
      </div>
      <button onClick={onPdf} className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-900 hover:bg-slate-100 text-sm">
        <Download size={14}/> Gerar PDF
      </button>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Pill active={rangeMode==='day'} onClick={() => setRangeMode('day')}><CalendarDays size={14}/> Dia</Pill>
      <Pill active={rangeMode==='week'} onClick={() => setRangeMode('week')}><CalendarRange size={14}/> Semana</Pill>
      <Pill active={rangeMode==='month'} onClick={() => setRangeMode('month')}><Calendar size={14}/> Mês</Pill>
      <Pill active={rangeMode==='custom'} onClick={() => setRangeMode('custom')}><FilterIcon size={14}/> Personalizado</Pill>
      {rangeMode==='custom' && (
        <div className="flex items-end gap-2 text-slate-900">
          <div className="bg-white rounded-lg px-2 py-1">
            <DateInput label="De" value={from} onChange={setFrom}/>
          </div>
          <div className="bg-white rounded-lg px-2 py-1">
            <DateInput label="Até" value={to} onChange={setTo}/>
          </div>
        </div>
      )}
    </div>

    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiTile title="Receita Total"   value={currency(Number(revenue.toFixed(2)))} icon={TrendingUp}/>
      <KpiTile title="Despesas Totais" value={currency(Number(expenses.toFixed(2)))} icon={TrendingDown}/>
      <KpiTile title="Margem de Lucro" value={`${marginPct}%`} icon={Percent}/>
    </div>
  </div>
);

/* ======================================================================
   Card “glass” + animação de expand
====================================================================== */
function useAnimatedNumber(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const prevRef = React.useRef(value);
  useEffect(() => {
    const from = prevRef.current, to = value;
    if (from === to) return;
    let raf = 0; const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      const next = Math.round((from + (to - from) * k) * 100) / 100;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { prevRef.current = to; setDisplay(to); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

type GlassCardProps = {
  title: string;
  icon: LucideIcon;
  color: 'blue'|'green'|'orange'|'purple';
  valueNumber?: number;
  valueText?: string;
  prefix?: string;
  suffix?: string;
  clickable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  children?: React.ReactNode;
};
const colorGrad: Record<GlassCardProps['color'], string> = {
  blue:   'from-blue-500 to-indigo-500',
  green:  'from-emerald-500 to-green-500',
  orange: 'from-orange-500 to-rose-500',
  purple: 'from-violet-500 to-fuchsia-500',
};
const GlassStatCard: React.FC<GlassCardProps> = ({
  title, icon: Icon, color,
  valueNumber, valueText, prefix, suffix,
  clickable, expanded, onToggleExpand, children
}) => {
  const animated = useAnimatedNumber(valueNumber ?? 0);
  const display = valueText ?? (() => {
    if (prefix?.trim().startsWith('R$')) {
      return `${prefix}${(animated).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix ?? ''}`;
    }
    return `${prefix ?? ''}${animated.toLocaleString('pt-BR')}${suffix ?? ''}`; })();

  const affordance = clickable ? (
    <span className="ml-2 inline-grid place-items-center rounded-lg p-1.5 bg-white/40 transition-all group-hover:bg-white/60 group-active:scale-95" aria-hidden>
      <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none">
        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  ) : null;

  return (
    <div className={["group relative w-full rounded-2xl bg-white/70 backdrop-blur border border-white/40 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all",
      expanded ? "ring-2 ring-blue-300/60" : "hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)]"].join(' ')}>
      <button
        type="button"
        onClick={clickable ? onToggleExpand : undefined}
        className={["w-full text-left rounded-2xl p-5", clickable ? "cursor-pointer active:scale-[0.99]" : "cursor-default"].join(' ')}
        aria-expanded={!!expanded}
        title={clickable ? "Toque para ver detalhes" : undefined}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-500 flex items-center">
              {title}
              {affordance}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
              {display}
            </div>
          </div>
          <div className={`ml-4 grid place-items-center rounded-xl p-2 bg-gradient-to-br ${colorGrad[color]} text-white shadow-lg`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </button>

      <div className={["overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
        expanded ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"].join(' ')}>
        <div className="mx-5 mt-2 mb-3 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
};

/* ======================================================================
   Página
====================================================================== */
const Reports: React.FC = () => {
  // auth
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) console.warn('getUser error:', error);
        if (alive) setUid(data.user?.id ?? null);
      } catch (e) {
        console.warn('getUser fatal:', e);
        if (alive) setUid(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  const { professionals } = useProfessionals();
  const { transactions } = useTransactions();
  const { history } = useAppointmentHistory();
  const { /* slots */ } = useAppointmentJourneys();

  const myHistory      = useMemo(() => byOwner(history, uid),      [history, uid]);
  const myTransactions = useMemo(() => byOwner(transactions, uid), [transactions, uid]);

  // período
  const [rangeMode, setRangeMode] = useState<RangeMode>('day');
  const [from, setFrom] = useState(todayLocalISO());
  const [to, setTo] = useState(todayLocalISO());
  const periodLabel = useMemo(() => periodLabelFor(rangeMode, from, to), [rangeMode, from, to]);

  useEffect(() => {
    if (rangeMode === 'custom') return;
    const now = new Date();
    if (rangeMode === 'day') {
      const d = todayLocalISO(); setFrom(d); setTo(d); return;
    }
    if (rangeMode === 'week') {
      const start = new Date(now); start.setDate(start.getDate() - start.getDay());
      const end = new Date(start); end.setDate(start.getDate() + 6);
      setFrom(toLocalISODate(start)); setTo(toLocalISODate(end)); return;
    }
    if (rangeMode === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(toLocalISODate(start)); setTo(toLocalISODate(end)); return;
    }
  }, [rangeMode]);

  // dados do período
  const rangeHistory = useMemo(
    () => myHistory.filter(h => (h.date ?? '') >= from && (h.date ?? '') <= to),
    [myHistory, from, to]
  );
  const completedRangeHistory = useMemo(
    () => rangeHistory.filter(h => isDone(h.status)), [rangeHistory]
  );
  const rangeTransactions = useMemo(
    () => myTransactions.filter(t => ((t as any).date ?? '') >= from && ((t as any).date ?? '') <= to),
    [myTransactions, from, to]
  );

  // métricas
  const commissionsForClinic = useMemo(() =>
    completedRangeHistory.reduce((s, h) => s + (Number(h.price)||0) * ((Number(h.clinicPercentage)||0)/100), 0)
  , [completedRangeHistory]);
  const totalExpenses = useMemo(() =>
    rangeTransactions.filter(t => isExpense(t.type)).reduce((s,t)=> s + (Number(t.amount)||0), 0)
  , [rangeTransactions]);
  const totalRevenue = useMemo(() =>
    rangeTransactions.filter(t => isIncome(t.type)).reduce((s,t)=> s + (Number(t.amount)||0), 0)
  , [rangeTransactions]);
  const profitMargin = useMemo(() =>
    totalRevenue > 0 ? (((totalRevenue-totalExpenses)/totalRevenue)*100).toFixed(1) : '0.0'
  , [totalRevenue,totalExpenses]);
  const uniquePatients = useMemo(() =>
    new Set(rangeHistory.map(h => (h.patientName ?? '').toString().toLowerCase())).size
  , [rangeHistory]);
  const completionRate = useMemo(() => {
    const total = rangeHistory.length, done = completedRangeHistory.length;
    return total > 0 ? ((done/total)*100).toFixed(1) : '0.0';
  }, [rangeHistory, completedRangeHistory]);

  // resumo por profissional
  const professionalReports = useMemo(() => {
    type Acc = { name: string; specialty?: string; patientsSet: Set<string>; attendanceValue: number; commission: number; totalAppointments: number; };
    const byKey = new Map<string, Acc>();
    const currentById: Record<string, { name: string; specialty?: string }> = {};
    for (const p of professionals) currentById[p.id] = { name: p.name, specialty: (p as any).specialty };

    for (const h of completedRangeHistory) {
      const rawId = (h as any).professionalId as string | null | undefined;
      const rawName = ((h as any).professionalName ?? '') as string;
      const key = (rawId && String(rawId)) || (rawName.trim() ? `name:${rawName.trim().toLowerCase()}` : 'unknown');
      const displayName = (rawId && currentById[rawId]?.name) || rawName || 'Profissional removido';
      const displaySpecialty = (rawId && currentById[rawId]?.specialty) || (h as any).professionalSpecialty || undefined;

      if (!byKey.has(key)) {
        byKey.set(key, { name: displayName, specialty: displaySpecialty, patientsSet: new Set(), attendanceValue: 0, commission: 0, totalAppointments: 0 });
      }
      const acc = byKey.get(key)!;
      const price = Number((h as any).price) || 0;
      const clinicPct = Number((h as any).clinicPercentage) || 0;
      const patientKey = ((h as any).patientName ?? '').toString().toLowerCase();
      acc.patientsSet.add(patientKey);
      acc.attendanceValue += price;
      acc.commission += price * (clinicPct / 100);
      acc.totalAppointments += 1;
    }

    return Array.from(byKey.values()).map(acc => ({
      name: acc.name,
      specialty: acc.specialty,
      patients: acc.patientsSet.size,
      attendanceValue: acc.attendanceValue,
      commission: acc.commission,
      totalAppointments: acc.totalAppointments,
    }));
  }, [completedRangeHistory, professionals]);

  // pacientes agregados
  const patientsAgg: PatientAgg[] = useMemo(() => {
    const map = new Map<string, PatientAgg>();
    for (const h of rangeHistory) {
      const nameRaw = (h.patientName ?? '').toString().trim();
      if (!nameRaw) continue;
      const key = nameRaw.toLowerCase();
      const date = (h.date ?? '');
      const phone = (h as any).patientPhone as string | undefined;
      if (!map.has(key)) map.set(key, { name: nameRaw, phone, count: 0, lastDate: date });
      const agg = map.get(key)!;
      agg.count += 1;
      if (date > agg.lastDate) agg.lastDate = date;
      if (!agg.phone && phone) agg.phone = phone;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [rangeHistory]);

  // modais e expansão
  const [showPatients, setShowPatients] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientModalName, setPatientModalName] = useState<string>('');
  const [patientVisits, setPatientVisits] = useState<PatientVisit[]>([]);
  const [patientsExpanded, setPatientsExpanded] = useState(false);

  const openPatient = (name: string) => {
    const specById: Record<string, string | undefined> = {};
    for (const p of professionals) specById[p.id] = (p as any).specialty;

    const visits = rangeHistory
      .filter(h => (h.patientName ?? '').toString().trim().toLowerCase() === name.toLowerCase())
      .sort((a,b) => (a.date + (a.startTime||'')).localeCompare(b.date + (b.startTime||'')))
      .map<PatientVisit>(h => {
        const pid = (h as any).professionalId as string | undefined;
        const nameFromHistory = (h as any).professionalName as string | undefined;
        const specFromHistory = (h as any).professionalSpecialty as string | undefined;
        return {
          date: h.date,
          time: (h.startTime && h.endTime) ? `${h.startTime}–${h.endTime}` : (h.startTime || ''),
          professional: nameFromHistory || professionals.find(p => p.id === pid)?.name,
          professionalSpecialty: specFromHistory || (pid ? specById[pid] : undefined),
          service: (h as any).service,
          price: Number(h.price) || null,
        };
      });

    setPatientModalName(name);
    setPatientVisits(visits);
    setPatientModalOpen(true);
  };

  // PDF geral
  const handleExportPdf = async () => {
    const range = rangeHistory;
    const byStatus: Record<string, number> = {};
    let revenue = 0;
    for (const h of range) {
      const st = (h.status ?? '').toLowerCase();
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (isDone(st)) {
        const price = Number(h.price) || 0;
        const clinicPct = Number(h.clinicPercentage) || 0;
        revenue += price * (clinicPct / 100);
      }
    }
    const rows: PdfRow[] = range
      .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))
      .map(h => ({
        date: h.date,
        time: (h.startTime && h.endTime) ? `${h.startTime}–${h.endTime}` : (h.startTime || ''),
        professional: h.professionalId
          ? (professionals.find(p => p.id === h.professionalId)?.name
              ?? (h as any).professionalName
              ?? 'Profissional removido')
          : ((h as any).professionalName ?? undefined),
        patient: h.patientName || undefined,
        status: (h.status ?? '').toLowerCase(),
        price: Number(h.price) || null,
      }));

    const blob = await pdf(
      <ReportDocument
        title="Relatório de Atendimentos"
        generatedAt={new Date().toLocaleString()}
        summary={{ periodLabel, total: rows.length, byStatus, revenue }}
        rows={rows}
      />
    ).toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${from}_a_${to}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ====================== RENDER ====================== */
  return (
    <div className="p-4 md:p-6 pb-24 bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/20 min-h-screen">
      {/* HERO */}
      <HeroReportsCard
        rangeMode={rangeMode}
        setRangeMode={setRangeMode}
        from={from} to={to}
        setFrom={setFrom} setTo={setTo}
        revenue={totalRevenue}
        expenses={totalExpenses}
        marginPct={profitMargin}
        onPdf={handleExportPdf}
      />

      {/* Botão PDF (mobile) */}
      <div className="mt-4 md:hidden">
        <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">
          <Download size={14}/> Gerar PDF
        </button>
      </div>

      {/* CARDS – sem repetir Receita/Despesas/Margem (estão no Hero) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
        <GlassStatCard
          title="Atendimentos no Período"
          icon={CheckCircle}
          color="blue"
          valueText={`${completedRangeHistory.length}/${rangeHistory.length}`}
        />
        <GlassStatCard
          title="Total de Pacientes"
          icon={Users}
          color="orange"
          valueNumber={uniquePatients}
          clickable
          expanded={patientsExpanded}
          onToggleExpand={() => setPatientsExpanded(v => !v)}
        >
          <div className="text-sm text-gray-600 mb-3">
            Alguns pacientes do período:
          </div>
          <div className="space-y-2">
            {patientsAgg.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center justify-between">
                <button
                  className="text-gray-800 hover:text-blue-700 font-medium"
                  onClick={() => openPatient(p.name)}
                  title="Ver atendimentos deste paciente"
                >
                  {abbreviateNamePT(p.name)}
                </button>
                <span className="text-xs text-gray-500">{p.count} {p.count === 1 ? 'atendimento' : 'atendimentos'}</span>
              </div>
            ))}
            {patientsAgg.length === 0 && (
              <div className="text-gray-500 text-sm">Nenhum paciente no período.</div>
            )}
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowPatients(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
            >
              Ver todos
            </button>
          </div>
        </GlassStatCard>
        <GlassStatCard
          title="Comissões Totais (Clínica)"
          icon={DollarSign}
          color="purple"
          valueNumber={Number(commissionsForClinic.toFixed(2))}
          prefix="R$ "
        />
        <GlassStatCard
          title="Taxa de Conclusão"
          icon={CheckCircle}
          color="green"
          valueNumber={Number(completionRate)}
          suffix="%"
        />
      </div>

      {/* Resumo por Profissional */}
      <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-5 md:mb-6">
          Resumo por Profissional ({periodLabel})
        </h2>

        <div className="space-y-5 md:space-y-6">
          {professionalReports.map((p, idx) => {
            // bar entre 0..1 baseado no maior valor bruto
            const maxGross = Math.max(1, ...professionalReports.map(x => x.attendanceValue));
            const bar = Math.min(1, p.attendanceValue / maxGross);

            return (
              <div key={idx} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                    {p.specialty && <div className="text-xs text-gray-500">{p.specialty}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-blue-600 font-semibold">{currency(Number(p.commission.toFixed(2)))}</div>
                    <div className="text-xs text-gray-500">Comissão (Clínica)</div>
                    <div className="text-sm text-gray-800 mt-1">{currency(Number(p.attendanceValue.toFixed(2)))}</div>
                    <div className="text-xs text-gray-500 -mt-0.5">Bruto</div>
                  </div>
                </div>

                {/* mini barra */}
                <div className="mt-3 h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${bar * 100}%` }} />
                </div>

                {/* chips pequenos */}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5">Pacientes: {p.patients}</span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5">Atendimentos: {p.totalAppointments}</span>
                </div>
              </div>
            );
          })}

          {professionalReports.length === 0 && (
            <div className="text-center py-8 text-gray-500">Nenhum dado disponível no período.</div>
          )}
        </div>
      </div>

      {/* MODAIS */}
      <PatientsModal
        open={showPatients}
        onClose={() => setShowPatients(false)}
        periodLabel={periodLabel}
        patients={patientsAgg}
        onOpenPatient={openPatient}
      />
      <PatientDetailsModal
        open={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        patientName={patientModalName}
        periodLabel={periodLabel}
        visits={patientVisits}
      />
    </div>
  );
};

export default Reports;
