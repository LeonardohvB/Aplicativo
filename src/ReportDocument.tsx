// src/pdf/ReportDocument.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export type Row = {
  date: string;
  time?: string;          // "HH:MM–HH:MM"
  professional?: string;
  patient?: string;
  status: string;
  price?: number | null;
};

export type Summary = {
  periodLabel: string;
  total: number;
  byStatus: Record<string, number>;
  revenue: number;
};

export type ReportProps = {
  title: string;
  generatedAt: string;
  summary: Summary;
  rows: Row[];
};

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 11, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, marginBottom: 6 },
  h2: { fontSize: 12, marginBottom: 8, color: '#555' },
  section: { marginVertical: 10 },
  line: { borderBottomWidth: 1, borderBottomColor: '#eee', marginVertical: 8 },
  head: { flexDirection: 'row', fontWeight: 700, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 4 },
  cell: { paddingRight: 8 },
  colDate: { width: 72 },
  colTime: { width: 84 },
  colProf: { width: 130 },
  colPatient: { width: 130 },
  colStatus: { width: 90 },
  colPrice: { width: 60, textAlign: 'right' },
  footer: { marginTop: 16, color: '#777' },
});

export default function ReportDocument({ title, generatedAt, summary, rows }: ReportProps) {
  const statusEntries = Object.entries(summary.byStatus || {});
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{title}</Text>
        <Text style={s.h2}>Gerado em: {generatedAt}</Text>

        <View style={s.section}>
          <Text>Período: {summary.periodLabel}</Text>
          <Text>Total de atendimentos: {summary.total}</Text>
          {!!statusEntries.length && (
            <Text>Por status: {statusEntries.map(([k, v]) => `${k}: ${v}`).join(' · ')}</Text>
          )}
          <Text>Receita (estimada): R$ {summary.revenue.toFixed(2)}</Text>
        </View>

        <View style={s.line} />

        <View style={s.head}>
          <Text style={[s.cell, s.colDate]}>Data</Text>
          <Text style={[s.cell, s.colTime]}>Horário</Text>
          <Text style={[s.cell, s.colProf]}>Profissional</Text>
          <Text style={[s.cell, s.colPatient]}>Paciente</Text>
          <Text style={[s.cell, s.colStatus]}>Status</Text>
          <Text style={[s.cell, s.colPrice]}>Valor</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={[s.cell, s.colDate]}>{r.date}</Text>
            <Text style={[s.cell, s.colTime]}>{r.time || '--'}</Text>
            <Text style={[s.cell, s.colProf]}>{r.professional || '-'}</Text>
            <Text style={[s.cell, s.colPatient]}>{r.patient || '-'}</Text>
            <Text style={[s.cell, s.colStatus]}>{r.status}</Text>
            <Text style={[s.cell, s.colPrice]}>{r.price != null ? `R$ ${Number(r.price).toFixed(2)}` : '-'}</Text>
          </View>
        ))}

        <Text style={s.footer}>Relatório gerado automaticamente pelo sistema.</Text>
      </Page>
    </Document>
  );
}
