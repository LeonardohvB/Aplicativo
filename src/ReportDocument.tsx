// src/ReportDocument.tsx
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Rect,
} from "@react-pdf/renderer";

/* ==================== Tipos ==================== */
export type Row = {
  date: string;                     // yyyy-mm-dd
  time?: string;                    // "HH:MM–HH:MM" ou "HH:MM"
  professional?: string;
  professionalSpecialty?: string;
  patient?: string;
  service?: string;
  status?: string;                  // concluido | cancelado | no_show | (aceita "Concluído", etc.)
  price?: number | null;            // valor bruto
  clinicCut?: number | null;        // parte da clínica (opcional)
};

type Summary = {
  periodLabel: string;
  total: number;
  byStatus?: Record<string, number>;
  revenue?: number; // receita (clínica) no período
  expenses?: number;
  profit?: number;
  margin?: number;  // %
};

type Props = {
  title?: string;
  generatedAt: string;
  summary: Summary;
  rows: Row[];
};

/* ==================== Helpers ==================== */
const currency = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const fmtBR = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");

// normaliza para comparar status vindo com acento/ícone/maiúsculas
const normStatus = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Conversões polares para pizza/DONUT (SVG) */
function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}

/* ==================== Cores e estilo ==================== */

const COLORS = {
  indigo: "#2563EB",     // azul mais claro (blue-600)
  violet: "#7C3AED",     // lilás mais vivo (violet-600)
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  bgCard: "#FFFFFF",
  concluidoBg: "#D1FAE5",
  concluidoTx: "#065F46",
  canceladoBg: "#FEF3C7",
  canceladoTx: "#78350F",
  noshowBg: "#FEE2E2",
  noshowTx: "#7F1D1D",
  pieDone: "#10B981",
  pieCancel: "#F59E0B",
  pieNoShow: "#EF4444",
  pieOther: "#94A3B8",
  dBlue: "#6366F1",
  dGreen: "#10B981",
  dOrange: "#F59E0B",
  dRed: "#EF4444",
  dViolet: "#A78BFA",
  valueBlue: "#2563EB",
};


const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 11, fontFamily: "Helvetica", color: COLORS.text },

  /* ===== Header ===== */
hero: {
  backgroundColor: COLORS.indigo,
  padding: 18,
  borderRadius: 14,
  color: "#fff",
  marginBottom: 14,
  // adiciona sombra suave simulando elevação
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
},
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroTitle: { fontSize: 18, fontWeight: 700, color: "#fff" },
heroPeriod: { fontSize: 10, color: "#EAF2FF", marginTop: 2 },
  heroBadge: {
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.45)",     // um pouco mais forte
  paddingVertical: 6,
  paddingHorizontal: 10,
  backgroundColor: "rgba(255,255,255,0.24)", // +opaco para ler os dígitos
  fontSize: 10,
  },

  /* ===== Cards KPI ===== */
  kpis: { flexDirection: "row", marginTop: 10 },

kpi: {
  flex: 1,
  // em vez de um fundo sólido, use vidro translúcido
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.35)',
  borderRadius: 10,
  padding: 10,
  marginRight: 8,
},
kpiTitle: { fontSize: 9, color: '#E0ECFF', marginBottom: 4 },
kpiValue: { fontSize: 13, fontWeight: 700, color: '#FFFFFF' },


  /* ===== Section headers ===== */
  sectionBand: {
    backgroundColor: COLORS.violet,
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  sectionBandTitle: { fontSize: 12, fontWeight: 700 },

  /* ===== Análise Visual ===== */
  chartsRow: { flexDirection: "row", gap: 10 as any, marginBottom: 8 },
  chartCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FAFAFA",
  },
  chartTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  chartWrap: { flexDirection: "row", alignItems: "center" },
  legend: { marginLeft: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 3 },

  /* ===== Mini resumo acima da tabela ===== */
  miniSummary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  miniItem: { fontSize: 10, color: COLORS.sub },
  miniItemBold: { color: COLORS.text, fontWeight: 700 },

  /* ===== Tabela principal ===== */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.violet,
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  th: { fontSize: 10, fontWeight: 700 },

  row: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  zebra: { backgroundColor: "#FBFBFB" },

  colDate: { width: 72 },
  colTime: { width: 72 },
  colProf: { flex: 1.15, paddingRight: 6 },
  colService: { flex: 0.9, paddingRight: 6 },
  colStatus: { width: 110 },
  colVal: { width: 80, textAlign: "right" },

  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 9,
    textAlign: "center",
    fontWeight: 700,
  },

  valueBlue: { color: COLORS.valueBlue, fontWeight: 700 },

  /* ===== Subtítulos + Tabelas de Resumo ===== */
  subTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
  },

  sumTableHeader: {
    flexDirection: "row",
    backgroundColor: "#111827",
    color: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  sumRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sumZebra: { backgroundColor: "#FBFBFB" },

  // colunas — Resumo por Profissional
  spColName: { flex: 1.2, paddingRight: 6 },
  spColCount: { width: 80, textAlign: "center" },
  spColGross: { width: 90, textAlign: "right" },
  spColClinic: { width: 80, textAlign: "right" },

  // colunas — Resumo por Paciente
  saColName: { flex: 1.2, paddingRight: 6 },
  saColCount: { width: 100, textAlign: "center" },
  saColGross: { width: 90, textAlign: "right" },

  footer: { marginTop: 12, color: COLORS.sub, fontSize: 9, textAlign: "right" },
});

/* ==================== Documento ==================== */
const ReportDocument: React.FC<Props> = ({
  title = "Relatório de Atendimentos",
  generatedAt,
  summary,
  rows,
}) => {
  // ordena por data+hora
  const ordered = [...rows].sort((a, b) =>
    (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))
  );

  /* ------ agregações ------ */
  const byStatus = summary.byStatus ?? {};
  const concluded = byStatus.concluido ?? 0;

  // distribuição por status (pizza)
  const counts = {
    concluido: byStatus.concluido ?? 0,
    cancelado: byStatus.cancelado ?? 0,
    no_show: byStatus.no_show ?? 0,
  };
  const outros = Math.max(0, summary.total - (counts.concluido + counts.cancelado + counts.no_show));
  const statusEntries = [
    { label: "Concluído", value: counts.concluido, color: COLORS.pieDone },
    { label: "Faltou",    value: counts.no_show,   color: COLORS.pieNoShow },
    { label: "Cancelado", value: counts.cancelado, color: COLORS.pieCancel },
    ...(outros > 0 ? [{ label: "Outros", value: outros, color: COLORS.pieOther }] : []),
  ].filter(e => e.value > 0);
  const pieTotal = statusEntries.reduce((s, e) => s + e.value, 0) || 1;

  const radius = 40, cx = 45, cy = 45;
  let ang = 0;
  const statusSlices = statusEntries.map(e => {
    const a = (e.value / pieTotal) * 360;
    const path = describeArc(cx, cy, radius, ang, ang + a);
    ang += a;
    return { ...e, path };
  });

  // distribuição por profissional (DONUT de valores CONCLUÍDOS)
  const doneRows = ordered.filter(r => normStatus(r.status) === "concluido");
  const profMap = new Map<string, number>(); // label => valor
  for (const r of doneRows) {
    const label = `${r.professional || "—"}${r.professionalSpecialty ? ` (${r.professionalSpecialty})` : ""}`;
    profMap.set(label, (profMap.get(label) || 0) + (Number(r.price) || 0));
  }
  const profEntries = Array.from(profMap.entries()).map(([label, value]) => ({ label, value }));
  const donutTotal = profEntries.reduce((s, e) => s + e.value, 0) || 1;
  const donutColors = [COLORS.dBlue, COLORS.dGreen, COLORS.dOrange, COLORS.dRed, COLORS.dViolet];
  ang = 0;
  const donutSlices = profEntries.map((e, i) => {
    const a = (e.value / donutTotal) * 360;
    const path = describeArc(cx, cy, radius, ang, ang + a);
    ang += a;
    return { ...e, path, color: donutColors[i % donutColors.length] };
  });

  // KPIs topo
  const revenue  = Number(summary.revenue  || 0);
  const expenses = Number(summary.expenses || 0);
  const profit   = summary.profit != null ? Number(summary.profit) : revenue - expenses;
  const margin   = summary.margin != null ? Number(summary.margin)  : (revenue > 0 ? (profit / revenue) * 100 : 0);

  // mini faixa de resumo
  const total = summary.total;
  const attendanceRate = total ? Math.round((concluded / total) * 100) : 0;
  const professionalsInvolved = new Set(ordered.map(r => (r.professional || "").toLowerCase()));
  const zebra = (i: number) => (i % 2 === 1 ? styles.zebra : ({} as any));

  /* ===== Resumo por PROFISSIONAL ===== */
  type ProfAgg = { name: string; concluded: number; total: number; gross: number; clinic: number; hasClinic: boolean; };
  const profAggMap = new Map<string, ProfAgg>();
  for (const r of ordered) {
    const name = r.professional || "—";
    if (!profAggMap.has(name)) profAggMap.set(name, { name, concluded: 0, total: 0, gross: 0, clinic: 0, hasClinic: false });
    const agg = profAggMap.get(name)!;
    agg.total += 1;
    if (normStatus(r.status) === "concluido") {
      agg.concluded += 1;
      agg.gross += Number(r.price || 0);
    }
    if (r.clinicCut != null) {
      agg.clinic += Number(r.clinicCut || 0);
      agg.hasClinic = true;
    }
  }
  const profSummary = Array.from(profAggMap.values());

  /* ===== Resumo por PACIENTE ===== */
  type PatAgg = { name: string; count: number; gross: number; };
  const patAggMap = new Map<string, PatAgg>();
  for (const r of ordered) {
    const name = r.patient || "—";
    if (!patAggMap.has(name)) patAggMap.set(name, { name, count: 0, gross: 0 });
    const agg = patAggMap.get(name)!;
    agg.count += 1;
    if (normStatus(r.status) === "concluido") {
      agg.gross += Number(r.price || 0);
    }
  }
  const patientSummary = Array.from(patAggMap.values());
  const sumZebra = (i: number) => (i % 2 === 1 ? styles.sumZebra : ({} as any));

  // render status pill (com normalização)
  const StatusPill: React.FC<{ s?: string }> = ({ s }) => {
    const k = normStatus(s);
    if (k === "concluido") {
      return (
        <Text style={[styles.statusPill, { backgroundColor: COLORS.concluidoBg, color: COLORS.concluidoTx }]}>
          ● ✓ Concluído
        </Text>
      );
    }
    if (k === "no_show") {
      return (
        <Text style={[styles.statusPill, { backgroundColor: COLORS.noshowBg, color: COLORS.noshowTx }]}>
          ● ⚠ Faltou
        </Text>
      );
    }
    if (k === "cancelado") {
      return (
        <Text style={[styles.statusPill, { backgroundColor: COLORS.canceladoBg, color: COLORS.canceladoTx }]}>
          ● ✕ Cancelado
        </Text>
      );
    }
    return <Text style={styles.statusPill}>{s || "—"}</Text>;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ===== HERO ===== */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroPeriod}>Período: {summary.periodLabel}</Text>
            </View>
            <Text style={styles.heroBadge}>Gerado em: {generatedAt}</Text>
          </View>

          {/* KPIs no hero */}
          <View style={styles.kpis}>
            <View style={styles.kpi}>
              <Text style={styles.kpiTitle}>Atendimentos Concluídos</Text>
              <Text style={styles.kpiValue}>{concluded}/{summary.total}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiTitle}>Receita (Clínica)</Text>
              <Text style={styles.kpiValue}>{currency(revenue)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiTitle}>Despesas</Text>
              <Text style={styles.kpiValue}>{currency(expenses)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiTitle}>Lucro</Text>
              <Text style={styles.kpiValue}>{currency(profit)}</Text>
            </View>
            <View style={[styles.kpi, { marginRight: 0 }]}>
              <Text style={styles.kpiTitle}>Margem</Text>
              <Text style={styles.kpiValue}>{`${margin.toFixed(1)}%`}</Text>
            </View>
          </View>
        </View>

        {/* ===== Banda de seção ===== */}
        <View style={styles.sectionBand}><Text style={styles.sectionBandTitle}>Análise Visual</Text></View>

        {/* ===== Gráficos ===== */}
        <View style={styles.chartsRow}>
          {/* Donut por profissional (valor concluído) */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Distribuição por Profissional (Valor Concluído)</Text>
            <View style={styles.chartWrap}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <Path d={describeArc(45, 45, 36, 0, 359.999)} fill="#FFFFFF" />
                <Path d={describeArc(45, 45, 40, 0, 359.999)} fill="#E5E7EB" />
                {donutSlices.map((s, i) => (<Path key={i} d={s.path} fill={s.color} />))}
                <Path d={describeArc(45, 45, 24, 0, 359.999)} fill="#FFFFFF" />
              </Svg>
              <View style={styles.legend}>
                {donutSlices.length === 0 ? (
                  <Text style={{ color: COLORS.sub, fontSize: 10 }}>Sem valores concluídos no período.</Text>
                ) : donutSlices.map((e, i) => (
                  <View key={i} style={styles.legendItem}>
                    <Svg width={10} height={10}><Rect x={0} y={0} width={10} height={10} fill={e.color} /></Svg>
                    <Text style={{ marginLeft: 6, fontSize: 10 }}>{e.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Pizza por status */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Distribuição por Status</Text>
            <View style={styles.chartWrap}>
              <Svg width={100} height={100} viewBox="0 0 100 100">
                <Path d={describeArc(cx, cy, 40, 0, 359.999)} fill="#E5E7EB" />
                {statusSlices.map((s, i) => (<Path key={i} d={s.path} fill={s.color} />))}
              </Svg>
              <View style={styles.legend}>
                {statusSlices.map((e, i) => (
                  <View key={i} style={styles.legendItem}>
                    <Svg width={10} height={10}><Rect x={0} y={0} width={10} height={10} fill={e.color} /></Svg>
                    <Text style={{ marginLeft: 6, fontSize: 10 }}>{e.label} — {e.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ===== Banda + mini resumo ===== */}
        <View style={styles.sectionBand}><Text style={styles.sectionBandTitle}>Histórico de Atendimentos</Text></View>

        <View style={styles.miniSummary}>
          <Text style={styles.miniItem}>Total de Atendimentos: <Text style={styles.miniItemBold}>{summary.total}</Text></Text>
          <Text style={styles.miniItem}>Taxa de Comparecimento: <Text style={styles.miniItemBold}>{attendanceRate}%</Text></Text>
          <Text style={styles.miniItem}>Profissionais Envolvidos: <Text style={styles.miniItemBold}>{professionalsInvolved.size}</Text></Text>
        </View>

        {/* ===== Tabela principal ===== */}
        <View style={styles.tableHeader}>
          <View style={styles.colDate}><Text style={styles.th}>DATA</Text></View>
          <View style={styles.colTime}><Text style={styles.th}>HORÁRIO</Text></View>
          <View style={styles.colProf}><Text style={styles.th}>PROFISSIONAL</Text></View>
          <View style={styles.colService}><Text style={styles.th}>SERVIÇO</Text></View>
          <View style={styles.colStatus}><Text style={styles.th}>STATUS</Text></View>
          <View style={styles.colVal}><Text style={[styles.th, { textAlign: "right" }]}>VALOR</Text></View>
        </View>

        {ordered.map((r, i) => (
          <View key={i} style={[styles.row, zebra(i)]}>
            <View style={styles.colDate}><Text>{fmtBR(r.date)}</Text></View>
            <View style={styles.colTime}><Text>{r.time || "—"}</Text></View>
            <View style={styles.colProf}>
              <Text>
                {r.professional || "—"}
                {r.professionalSpecialty ? `\n${r.professionalSpecialty}` : ""}
              </Text>
            </View>
            <View style={styles.colService}><Text>{r.service || "—"}</Text></View>
            <View style={styles.colStatus}><StatusPill s={r.status} /></View>
            <View style={styles.colVal}><Text style={styles.valueBlue}>{r.price != null ? currency(r.price) : "—"}</Text></View>
          </View>
        ))}

        {/* ===== Resumo por Profissional ===== */}
        <Text style={styles.subTitle}>Resumo por Profissional</Text>
        <View style={styles.sumTableHeader}>
          <View style={styles.spColName}><Text style={styles.th}>Profissional</Text></View>
          <View style={styles.spColCount}><Text style={styles.th}>Concl./Total</Text></View>
          <View style={styles.spColGross}><Text style={[styles.th, { textAlign: "right" }]}>Bruto</Text></View>
          <View style={styles.spColClinic}><Text style={[styles.th, { textAlign: "right" }]}>Clínica</Text></View>
        </View>
        {profSummary.map((p, i) => (
          <View key={i} style={[styles.sumRow, sumZebra(i)]}>
            <View style={styles.spColName}><Text>{p.name}</Text></View>
            <View style={styles.spColCount}><Text>{p.concluded}/{p.total}</Text></View>
            <View style={styles.spColGross}><Text style={styles.valueBlue}>{currency(p.gross)}</Text></View>
            <View style={styles.spColClinic}><Text>{p.hasClinic ? currency(p.clinic) : "—"}</Text></View>
          </View>
        ))}

        {/* ===== Resumo por Paciente ===== */}
        <Text style={styles.subTitle}>Resumo por Paciente</Text>
        <View style={styles.sumTableHeader}>
          <View style={styles.saColName}><Text style={styles.th}>Paciente</Text></View>
          <View style={styles.saColCount}><Text style={styles.th}>Atendimentos</Text></View>
          <View style={styles.saColGross}><Text style={[styles.th, { textAlign: "right" }]}>Bruto</Text></View>
        </View>
        {patientSummary.map((p, i) => (
          <View key={i} style={[styles.sumRow, sumZebra(i)]}>
            <View style={styles.saColName}><Text>{p.name}</Text></View>
            <View style={styles.saColCount}><Text>{p.count}</Text></View>
            <View style={styles.saColGross}><Text style={styles.valueBlue}>{currency(p.gross)}</Text></View>
          </View>
        ))}

        <Text style={styles.footer}>Gerado em {generatedAt}</Text>
      </Page>
    </Document>
  );
};

export default ReportDocument;
