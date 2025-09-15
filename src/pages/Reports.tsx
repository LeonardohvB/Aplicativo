// src/pages/Reports.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Percent, Users, Calendar, DollarSign, CheckCircle, Download,
  CalendarDays, CalendarRange, Filter as FilterIcon, X, Phone, FileText, Search
} from 'lucide-react';
import StatCard from '../components/Dashboard/StatCard';
import { useProfessionals } from '../hooks/useProfessionals';
import { useTransactions } from '../hooks/useTransactions';
import { useAppointmentHistory } from '../hooks/useAppointmentHistory';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { supabase } from '../lib/supabase';
import { pdf, Document, Page, Text, View, StyleSheet, Svg, Path, Rect} from '@react-pdf/renderer';
import ReportDocument, { Row as PdfRow } from '../ReportDocument';


/* ===== helpers ===== */
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

/* ===== INPUT DE DATA ===== */
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

/* ===== PDF moderno por Paciente ===== */
type PatientVisit = {
  date: string;                 // yyyy-mm-dd
  time: string;                 // "HH:MM–HH:MM" ou "HH:MM"
  professional?: string;        // nome
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

  // pizza
  chartWrap: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
});

// paleta fixa (PDF não suporta CSS vars). pode aumentar se quiser.
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
  patientName: string;
  periodLabel: string;
  visits: PatientVisit[];
}> = ({ patientName, periodLabel, visits }) => {
  const total = visits.length;
  const totalValue = visits.reduce((s, v) => s + (Number(v.price) || 0), 0);

  // agrupa por "nome#spec"
  const byProf = new Map<string, { name: string; spec?: string; value: number; count: number }>();
  for (const v of visits) {
    const name = v.professional || '—';
    const spec = v.professionalSpecialty;
    const key = `${name}#${spec ?? ''}`;
    if (!byProf.has(key)) byProf.set(key, { name, spec, value: 0, count: 0 });
    const x = byProf.get(key)!;
    x.value += Number(v.price) || 0;
    x.count += 1;
  }

  // dados do gráfico
  const entries = Array.from(byProf.values());
  const sum = entries.reduce((s, e) => s + e.value, 0) || 1; // evita div/0
  let cursor = 0;
  const radius = 42;
  const cx = 50, cy = 50; // centro do SVG (largura/altura 100)
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

        {/* cards */}
        <View style={pdfStyles.cardRow}>
          <View style={pdfStyles.card}>
            <Text style={pdfStyles.cardTitle}>Atendimentos no período</Text>
            <Text style={pdfStyles.cardValue}>{total}</Text>
          </View>
          <View style={pdfStyles.card}>
            <Text style={pdfStyles.cardTitle}>Valor total</Text>
            <Text style={pdfStyles.cardValue}>{currency(totalValue)}</Text>
          </View>
          <View style={pdfStyles.card}>
            <Text style={pdfStyles.cardTitle}>Profissionais atendentes</Text>
            <Text style={pdfStyles.cardValue}>{byProf.size}</Text>
          </View>
        </View>

        {/* gráfico de pizza */}
        <Text style={pdfStyles.sectionTitle}>Distribuição por Profissional (valor)</Text>
        <View style={pdfStyles.chartWrap}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            {/* fundo (cinza claro) */}
            <Path d={describeArc(cx, cy, radius, 0, 359.999)} fill="#E5E7EB" />
            {slices.map((s, i) => (
              <Path key={i} d={s.path} fill={s.color} />
            ))}
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

        {/* Tabela */}
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
            <View style={pdfStyles.colProf}>
              <Text>
                {r.professional || '—'}{r.professionalSpecialty ? ` — ${r.professionalSpecialty}` : ''}
              </Text>
            </View>
            <View style={pdfStyles.colSvc}><Text>{r.service || '—'}</Text></View>
            <View style={pdfStyles.colVal}><Text>{r.price != null ? currency(r.price) : '—'}</Text></View>
          </View>
        ))}

      
        <Text style={pdfStyles.footer}>Gerado em {new Date().toLocaleString('pt-BR')}</Text>
      </Page>
    </Document>
  );
};

/* ===== Modal de Pacientes (com busca) ===== */
type PatientAgg = { name: string; phone?: string; count: number; lastDate: string; };
const PatientsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  periodLabel: string;
  patients: PatientAgg[];
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

/* ===== Modal de Detalhes do Paciente + PDF ===== */
const PatientDetailsModal: React.FC<{
  open: boolean;
  onClose: () => void;
  patientName: string;
  periodLabel: string;
  visits: PatientVisit[];
}> = ({ open, onClose, patientName, periodLabel, visits }) => {
  const total = visits.length;
  const totalValue = visits.reduce((s, v) => s + (Number(v.price) || 0), 0);

  // agrupa por "nome#especialidade" para diferenciar homônimos
  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; spec?: string; count: number; value: number }>();
    for (const v of visits) {
      const name = v.professional || '—';
      const spec = v.professionalSpecialty;
      const key = `${name}#${spec ?? ''}`;
      if (!m.has(key)) m.set(key, { name, spec, count: 0, value: 0 });
      const x = m.get(key)!;
      x.count += 1;
      x.value += Number(v.price) || 0;
    }
    return Array.from(m.values());
  }, [visits]);

  const handlePdf = async () => {
    const blob = await pdf(
      <PatientPdfDocument
        patientName={patientName}
        periodLabel={periodLabel}
        visits={visits}
      />
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

        {/* Resumos */}
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

        {/* Por profissional (com especialidade) */}
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

        {/* Lista de visitas (com especialidade) */}
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

/* ======================= PÁGINA ======================= */
const Reports: React.FC = () => {
  // uid
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

  /* período */
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

  /* dados do período */
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

  /* métricas */
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

  /* resumo por profissional (robusto) */
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

  /* Pacientes (agg a partir do rangeHistory) */
  const patientsAgg: PatientAgg[] = useMemo(() => {
    const map = new Map<string, PatientAgg>(); // key = nome lower
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

  // estados de modais
  const [showPatients, setShowPatients] = useState(false);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientModalName, setPatientModalName] = useState<string>('');
  const [patientVisits, setPatientVisits] = useState<PatientVisit[]>([]);

  const openPatient = (name: string) => {
  // map auxiliar id -> specialty (caso exista na tabela atual)
  const specById: Record<string, string | undefined> = {};
  for (const p of professionals) {
    specById[p.id] = (p as any).specialty;
  }

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

  /* PDF geral (já existia) */
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

  return (
    <div className="p-4 md:p-6 pb-24 bg-gray-50 min-h-screen">
      {/* Cabeçalho + Filtros */}
      <div className="flex flex-col gap-3 mb-5 md:mb-6 md:flex-row md:items-end md:justify-between">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Relatórios</h1>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setRangeMode('day')}   className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${rangeMode==='day'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-200'}`}><CalendarDays size={14}/> Dia</button>
            <button onClick={() => setRangeMode('week')}  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${rangeMode==='week'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-200'}`}><CalendarRange size={14}/> Semana</button>
            <button onClick={() => setRangeMode('month')} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${rangeMode==='month'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-200'}`}><Calendar size={14}/> Mês</button>
            <button onClick={() => setRangeMode('custom')}className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm ${rangeMode==='custom'?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-700 border-gray-200'}`}><FilterIcon size={14}/> Personalizado</button>
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            {rangeMode === 'custom' && (<><DateInput label="Data inicial" value={from} onChange={setFrom}/><DateInput label="Data final" value={to} onChange={setTo}/></>)}
            <button onClick={handleExportPdf} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"><Download size={14}/> Gerar PDF</button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard title="Atendimentos no Período" value={`${completedRangeHistory.length}/${rangeHistory.length}`} icon={CheckCircle} color="blue" />
        <StatCard title="Receita Total" value={currency(Number(totalRevenue.toFixed(2)))} icon={TrendingUp} color="green" />
        <StatCard title="Despesas Totais" value={currency(Number(totalExpenses.toFixed(2)))} icon={TrendingDown} color="orange" />
        <StatCard title="Margem de Lucro" value={`${profitMargin}%`} icon={Percent} color="blue" />
        <div role="button" onClick={() => setShowPatients(true)} className="cursor-pointer active:scale-[0.99] transition-transform" title="Ver pacientes do período">
          <StatCard title="Total de Pacientes" value={uniquePatients} icon={Users} color="orange" />
        </div>
        <StatCard title="Comissões Totais (Clínica)" value={currency(Number(commissionsForClinic.toFixed(2)))} icon={DollarSign} color="purple" />
        <StatCard title="Taxa de Conclusão" value={`${completionRate}%`} icon={CheckCircle} color="green" />
      </div>

      {/* Resumo por Profissional */}
      <div className="bg-white rounded-xl p-5 md:p-6 shadow-sm border border-gray-100">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-5 md:mb-6">Resumo por Profissional ({periodLabel})</h2>
        <div className="space-y-5 md:space-y-6">
          {professionalReports.map((prof, index) => (
            <div key={index} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base">{prof.name}</h3>
                  {prof.specialty && <p className="text-gray-600 text-xs md:text-sm">{prof.specialty}</p>}
                </div>
                <div className="text-right text-xs md:text-sm text-gray-500">{prof.totalAppointments} atendimentos</div>
              </div>
              <div className="grid grid-cols-3 gap-3 md:gap-4">
                <div className="text-center"><p className="text-gray-500 text-xs md:text-sm mb-1">Pacientes</p><p className="text-blue-600 font-semibold text-base md:text-lg">{prof.patients}</p></div>
                <div className="text-center"><p className="text-gray-500 text-xs md:text-sm mb-1">Atendimentos</p><p className="text-blue-600 font-semibold text-base md:text-lg">{currency(Number(prof.attendanceValue.toFixed(0)))}</p></div>
                <div className="text-center"><p className="text-gray-500 text-xs md:text-sm mb-1">Comissão (Clínica)</p><p className="text-blue-600 font-semibold text-base md:text-lg">{currency(Number(prof.commission.toFixed(0)))}</p></div>
              </div>
            </div>
          ))}
          {professionalReports.length === 0 && (<div className="text-center py-8 text-gray-500">Nenhum dado disponível no período.</div>)}
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
