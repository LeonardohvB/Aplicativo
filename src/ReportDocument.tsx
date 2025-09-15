// src/ReportDocument.tsx
import React from 'react';
import {
  Document, Page, Text, View, StyleSheet, Svg, Path, Rect,
} from '@react-pdf/renderer';

/* ============ Tipos ============ */
export type Row = {
  date: string;                 // yyyy-mm-dd
  time?: string;                // "HH:MM–HH:MM" ou "HH:MM"
  professional?: string;
  professionalSpecialty?: string;
  patient?: string;
  status?: string;              // concluido | cancelado | no_show | ...
  price?: number | null;        // bruto
  clinicCut?: number | null;    // parte da clínica (opcional)
};

type Summary = {
  periodLabel: string;
  total: number;
  byStatus?: Record<string, number>;
  revenue?: number;
  expenses?: number;
  profit?: number;
  margin?: number;              // %
};

type Props = {
  title?: string;
  generatedAt: string;
  summary: Summary;
  rows: Row[];
};

/* ============ Helpers ============ */
const currency = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtBR = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

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

/* ============ Estilos ============ */
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 11, fontFamily: 'Helvetica' },

  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 12, color: '#4B5563' },

  cardsRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, padding: 10 },
  cardTitle: { fontSize: 9, color: '#6B7280', marginBottom: 4 },
  cardValue: { fontSize: 12, fontWeight: 700, color: '#111827' },

  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },

  chartWrap: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 10 },
  legend: { flexWrap: 'wrap', flexDirection: 'column' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    color: '#FFFFFF',
    padding: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  th: { fontSize: 10, fontWeight: 700 },

  row: {
    flexDirection: 'row',
    padding: 8,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  rowAlt: { backgroundColor: '#FAFAFA' },

  colDate: { width: 70 },
  colTime: { width: 70 },
  colProf: { flex: 1.1 },
  colPatient: { flex: 1 },
  colStatus: { width: 75 },
  colVal: { width: 70, textAlign: 'right' },

  smallNote: { fontSize: 9, color: '#6B7280', marginTop: 2 },

  // Resumos (tabelas compactas)
  miniHeader: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    color: '#fff',
    padding: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  miniRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  miniRowAlt: { backgroundColor: '#F9FAFB' },
  mColProf: { flex: 1.2 },               // Profissional / Paciente
  mColMid:  { width: 95, textAlign: 'right' }, // Concl./Total ou Atendimentos
  mColVal:  { width: 105, textAlign: 'right' },// Bruto
  mColVal2: { width: 105, textAlign: 'right' },// Clínica
  footer: { marginTop: 12, color: '#6B7280', fontSize: 9, textAlign: 'right' },
});

/* ============ Cores do gráfico ============ */
const COLORS = {
  concluido: '#34D399',
  cancelado: '#F87171',
  no_show:   '#F59E0B',
  outros:    '#94A3B8',
};

/* ============ Documento ============ */
const ReportDocument: React.FC<Props> = ({
  title = 'Relatório Geral',
  generatedAt,
  summary,
  rows,
}) => {
  // ordena por data+hora
  const ordered = [...rows].sort((a, b) =>
    (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
  );

  // métricas topo
  const byStatus = summary.byStatus ?? {};
  const concluded = byStatus.concluido ?? 0;

  // pizza por status
  const counts = {
    concluido: byStatus.concluido ?? 0,
    cancelado: byStatus.cancelado ?? 0,
    no_show:   byStatus.no_show   ?? 0,
  };
  const outros = Math.max(0, summary.total - (counts.concluido + counts.cancelado + counts.no_show));
  const chartEntries = [
    { key: 'concluido', label: 'Concluídos', value: counts.concluido, color: COLORS.concluido },
    { key: 'cancelado', label: 'Cancelados', value: counts.cancelado, color: COLORS.cancelado },
    { key: 'no_show',   label: 'Faltaram',   value: counts.no_show,   color: COLORS.no_show },
    { key: 'outros',    label: 'Outros',     value: outros,           color: COLORS.outros },
  ].filter(e => e.value > 0);
  const totalForChart = chartEntries.reduce((s, e) => s + e.value, 0) || 1;
  const radius = 42; const cx = 50; const cy = 50;
  let cursor = 0;
  const slices = chartEntries.map(e => {
    const angle = (e.value / totalForChart) * 360;
    const path = describeArc(cx, cy, radius, cursor, cursor + angle);
    cursor += angle;
    return { ...e, path };
  });

  // agregações (profissional e paciente)
  type ProfAgg = {
    name: string;
    spec?: string;
    totalCount: number;
    doneCount: number;
    gross: number;
    clinic: number;
  };
  const profMap = new Map<string, ProfAgg>(); // key: "name#spec"
  const patientMap = new Map<string, { count: number; gross: number }>();

  for (const r of ordered) {
    const name = (r.professional || '—').trim();
    const spec = r.professionalSpecialty?.trim();
    const key = `${name}#${spec ?? ''}`;
    if (!profMap.has(key)) {
      profMap.set(key, { name, spec, totalCount: 0, doneCount: 0, gross: 0, clinic: 0 });
    }
    const p = profMap.get(key)!;
    p.totalCount += 1;
    if ((r.status ?? '').toLowerCase() === 'concluido') p.doneCount += 1;
    p.gross += Number(r.price) || 0;
    p.clinic += Number(r.clinicCut) || 0;

    const patient = (r.patient || '—').trim();
    if (!patientMap.has(patient)) patientMap.set(patient, { count: 0, gross: 0 });
    const ag = patientMap.get(patient)!;
    ag.count += 1;
    ag.gross += Number(r.price) || 0;
  }

  const profAggs = Array.from(profMap.values()).sort((a, b) => b.gross - a.gross);
  const patientAggs = Array.from(patientMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross - a.gross);

  const revenue = Number(summary.revenue || 0);
  const expenses = Number(summary.expenses || 0);
  const profit = summary.profit != null ? Number(summary.profit) : (revenue - expenses);
  const margin = summary.margin != null
    ? Number(summary.margin)
    : (revenue > 0 ? ((profit / revenue) * 100) : 0);

  // helper para zebra sem null no style
  const zebra = (i: number) => (i % 2 === 1 ? styles.rowAlt : ({} as any));
  const zebraMini = (i: number) => (i % 2 === 1 ? styles.miniRowAlt : ({} as any));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Período: {summary.periodLabel}</Text>
        </View>

        {/* Cards executivos */}
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Atendimentos no período</Text>
            <Text style={styles.cardValue}>{concluded}/{summary.total}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Receita (Clínica)</Text>
            <Text style={styles.cardValue}>{currency(revenue)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Despesas</Text>
            <Text style={styles.cardValue}>{currency(expenses)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lucro</Text>
            <Text style={styles.cardValue}>{currency(profit)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Margem</Text>
            <Text style={styles.cardValue}>{`${margin.toFixed(1)}%`}</Text>
          </View>
        </View>

        {/* Gráfico por status */}
        {chartEntries.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Distribuição por Status</Text>
            <View style={styles.chartWrap}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <Path d={describeArc(cx, cy, radius, 0, 359.999)} fill="#E5E7EB" />
                {slices.map((s, i) => (<Path key={i} d={s.path} fill={s.color} />))}
              </Svg>
              <View style={styles.legend}>
                {chartEntries.map((e, i) => (
                  <View key={i} style={styles.legendItem}>
                    <Svg width={10} height={10}><Rect x={0} y={0} width={10} height={10} fill={e.color} /></Svg>
                    <Text>{e.label} — {e.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Tabela principal */}
        <Text style={styles.sectionTitle}>Atendimentos</Text>
        <View style={styles.tableHeader}>
          <View style={styles.colDate}><Text style={styles.th}>Data</Text></View>
          <View style={styles.colTime}><Text style={styles.th}>Horário</Text></View>
          <View style={styles.colProf}><Text style={styles.th}>Profissional</Text></View>
          <View style={styles.colPatient}><Text style={styles.th}>Paciente</Text></View>
          <View style={styles.colStatus}><Text style={styles.th}>Status</Text></View>
          <View style={styles.colVal}><Text style={styles.th}>Valor</Text></View>
        </View>

        {ordered.map((r, i) => (
          <View key={i} style={[styles.row, zebra(i)]}>
            <View style={styles.colDate}><Text>{fmtBR(r.date)}</Text></View>
            <View style={styles.colTime}><Text>{r.time || ''}</Text></View>
            <View style={styles.colProf}>
              <Text>
                {r.professional || '—'}{r.professionalSpecialty ? ` — ${r.professionalSpecialty}` : ''}
              </Text>
            </View>
            <View style={styles.colPatient}><Text>{r.patient || '—'}</Text></View>
            <View style={styles.colStatus}>
              <Text>
                {(r.status || '')
                  .toString()
                  .replace(/_/g, ' ')
                  .replace(/^\w/, c => c.toUpperCase())}
              </Text>
            </View>
            <View style={styles.colVal}><Text>{r.price != null ? currency(r.price) : '—'}</Text></View>
          </View>
        ))}
        <Text style={styles.smallNote}>Valores na coluna “Valor” são brutos por atendimento.</Text>

        {/* Resumo por Profissional (tabela) */}
        <Text style={styles.sectionTitle}>Resumo por Profissional</Text>
        <View style={styles.miniHeader}>
          <View style={styles.mColProf}><Text style={styles.th}>Profissional</Text></View>
          <View style={styles.mColMid}><Text style={[styles.th, { textAlign: 'right' }]}>Concl./Total</Text></View>
          <View style={styles.mColVal}><Text style={[styles.th, { textAlign: 'right' }]}>Bruto</Text></View>
          <View style={styles.mColVal2}><Text style={[styles.th, { textAlign: 'right' }]}>Clínica</Text></View>
        </View>
        {profAggs.map((p, i) => (
          <View key={i} style={[styles.miniRow, zebraMini(i)]}>
            <View style={styles.mColProf}>
              <Text>{p.name}{p.spec ? ` — ${p.spec}` : ''}</Text>
            </View>
            <View style={styles.mColMid}><Text>{p.doneCount}/{p.totalCount}</Text></View>
            <View style={styles.mColVal}><Text>{currency(p.gross)}</Text></View>
            <View style={styles.mColVal2}><Text>{p.clinic > 0 ? currency(p.clinic) : '—'}</Text></View>
          </View>
        ))}

        {/* Resumo por Paciente (tabela) */}
        <Text style={styles.sectionTitle}>Resumo por Paciente</Text>
        <View style={styles.miniHeader}>
          <View style={styles.mColProf}><Text style={styles.th}>Paciente</Text></View>
          <View style={styles.mColMid}><Text style={[styles.th, { textAlign: 'right' }]}>Atendimentos</Text></View>
          <View style={styles.mColVal}><Text style={[styles.th, { textAlign: 'right' }]}>Bruto</Text></View>
          <View style={styles.mColVal2}><Text style={[styles.th, { textAlign: 'right' }]}>{' '}</Text></View>
        </View>
        {patientAggs.map((p, i) => (
          <View key={i} style={[styles.miniRow, zebraMini(i)]}>
            <View style={styles.mColProf}><Text>{p.name}</Text></View>
            <View style={styles.mColMid}><Text>{p.count}</Text></View>
            <View style={styles.mColVal}><Text>{currency(p.gross)}</Text></View>
            <View style={styles.mColVal2}><Text>{' '}</Text></View>
          </View>
        ))}

        <Text style={styles.footer}>Gerado em {generatedAt}</Text>
      </Page>
    </Document>
  );
};

export default ReportDocument;
