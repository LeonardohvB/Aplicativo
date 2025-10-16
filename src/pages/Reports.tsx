// src/pages/Reports.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp, TrendingDown, Percent, Users, Calendar, DollarSign, CheckCircle, Download,
  CalendarDays, CalendarRange, Filter as FilterIcon, X, Phone, Search, LucideIcon
} from 'lucide-react';
import { useProfessionals } from '../hooks/useProfessionals';
import { useTransactions } from '../hooks/useTransactions';
import { useAppointmentHistory } from '../hooks/useAppointmentHistory';
import { useAppointmentJourneys } from '../hooks/useAppointmentJourneys';
import { supabase } from '../lib/supabase';
import { pdf } from '@react-pdf/renderer';
import ReportDocument, { Row as PdfRow,} from '../ReportDocument';

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
const isDone = (s?: string) => (s ?? '').toLowerCase() === 'concluido';
const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ===== Helpers de valores e datas ===== */
function parseAmountBR(input: any): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  let raw = String(input).normalize('NFKD').replace(/[\u2212\u2013\u2014]/g, '-').trim();
  let negative = /^\(.*\)$/.test(raw);
  if (/-/.test(raw)) negative = true;
  let cleaned = raw.replace(/[^\d,.\-]/g, '');
  cleaned = cleaned.replace(/-/g, '');
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.');
  let n = parseFloat(cleaned);
  if (!Number.isFinite(n)) n = 0;
  return negative ? -Math.abs(n) : n;
}
const parseStrDate = (s?: string | null): Date | null => {
  if (!s) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/').map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const isWithin = (d: Date, fromISO: string, toISO: string) => {
  const fromD = new Date(`${fromISO}T00:00:00`);
  const toD   = new Date(`${toISO}T23:59:59.999`);
  return d >= fromD && d <= toD;
};

const STATUS_LABEL_PT: Record<string, string> = {
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  no_show:   'Faltou',
};

/* ======================================================================
   Mini input de data
====================================================================== */
const DateInput: React.FC<{ label: string; value: string; onChange: (v: string) => void; }> = ({
  label, value, onChange
}) => (
  <div className="w-full min-w-0">
    <span className="block text-xs text-gray-600 mb-1">{label}</span>
    <div className="relative">
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-8 pr-2.5 py-2 rounded-lg border bg-white border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  </div>
);

/* ======================================================================
   Tipos do modal do Paciente
====================================================================== */
type PatientVisit = {
  date: string;
  time: string;
  professional?: string;
  professionalSpecialty?: string | undefined;
  service?: string;
  price?: number | null;
  status?: 'concluido'|'cancelado'|'no_show'|string;
};

type PatientAgg = { name: string; phone?: string; count: number; lastDate: string; };

/* ======================================================================
   Util: gera HTML para preview (modelo fornecido)
====================================================================== */
function buildPatientPreviewHTML(opts: {
  clinic_Name?: string;
  clinic_Cnpj?: string;
  patientName: string;
  patientCpf?: string;
  patientBirth?: string;    // DD/MM/AAAA (opcional)
  patientAge?: string;      // "26 anos" (opcional)
  patientPhoneEmail?: string;
  periodLabel: string;
  visits: PatientVisit[];
}) {
  const {
    clinic_Name = '—',
    clinic_Cnpj = '—',
    patientName,
    patientCpf = '—',
    patientBirth = '—',
    patientAge = '',
    patientPhoneEmail = '—',
    periodLabel,
    visits
  } = opts;

  const total = visits.length;
  const done  = visits.filter(v => (v.status||'').toLowerCase()==='concluido').length;
  const cancel= visits.filter(v => (v.status||'').toLowerCase()==='cancelado').length;
  const noshow= visits.filter(v => (v.status||'').toLowerCase()==='no_show').length;
  const attendRate = total ? Math.round((done/total)*100) : 0;

  const totalValueDone = visits
    .filter(v => (v.status||'').toLowerCase()==='concluido')
    .reduce((s,v)=> s + (Number(v.price)||0), 0);

  const avg = done ? totalValueDone / done : 0;

  const byProf = new Map<string, { label: string; value: number }>();
  for (const v of visits.filter(v => (v.status||'').toLowerCase()==='concluido')) {
    const label = `${v.professional ?? '—'}\n(${v.professionalSpecialty ?? '—'})`;
    if (!byProf.has(label)) byProf.set(label, { label, value: 0 });
    byProf.get(label)!.value += Number(v.price)||0;
  }
  const profLabels = Array.from(byProf.values()).map(x=>x.label);
  const profValues = Array.from(byProf.values()).map(x=>Number(x.value.toFixed(2)));

  const statusLabels = ['Concluído','Faltou','Cancelado'];
  const statusValues = [done, noshow, cancel];

  const lastDate = visits.length ? fmtBR(
    visits.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).slice(-1)[0].date
  ) : '—';

  const rowsHtml = visits.map(v => {
    const status = (v.status||'').toLowerCase();
    const statusClass =
      status === 'concluido' ? 'concluido' :
      status === 'no_show'   ? 'faltou' :
      status === 'cancelado' ? 'cancelado' : '';
    const statusLabel =
      status === 'concluido' ? '✓ Concluído' :
      status === 'no_show'   ? '⚠ Faltou' :
      status === 'cancelado' ? '✕ Cancelado' : (status || '—');

    return `
      <tr>
        <td>${fmtBR(v.date)}</td>
        <td>${v.time || '—'}</td>
        <td><span class="professional">${v.professional || '—'}<br><span class="role">${v.professionalSpecialty || ''}</span></span></td>
        <td>${v.service || '—'}</td>
        <td><span class="status ${statusClass}">${statusLabel}</span></td>
        <td class="valor">${v.price!=null ? currency(Number(v.price)) : '—'}</td>
      </tr>
    `;
  }).join('');

  const todayStr = new Date().toLocaleString('pt-BR');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Relatório do Paciente</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:40px 20px;min-height:100vh}
.container{max-width:1000px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.1);overflow:hidden}
.header-clinic{background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:30px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:30px}
.clinic-info-left{display:flex;gap:20px;flex:1}
.clinic-logo{width:70px;height:70px;background:#fff;color:#2563eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;flex-shrink:0}
.clinic-info-left h2{font-size:24px;font-weight:700;margin-bottom:8px}
.clinic-info-left p{font-size:13px;opacity:.95;line-height:1.5}
.clinic-info-right{text-align:right}
.prontuario-badge{background:rgba(255,255,255,.15);padding:15px 20px;border-radius:8px;margin-bottom:15px;border:1px solid rgba(255,255,255,.3)}
.prontuario-label{font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:1px;margin:0}
.prontuario-badge h3{font-size:22px;font-weight:700;margin:0;color:#fff}
.data-geracao{font-size:13px;opacity:.9}
.patient-info{background:#f9fafb;padding:25px 30px;border-bottom:1px solid #e5e7eb}
.patient-info h3{font-size:16px;font-weight:700;color:#1f2937;margin-bottom:20px;text-transform:uppercase;letter-spacing:.5px}
.patient-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:25px}
.patient-field label{display:block;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.patient-field p{font-size:15px;color:#1f2937;font-weight:500;margin:0}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:30px;color:#fff;margin-top:0}
.header h1{font-size:26px;margin-bottom:8px;font-weight:700}
.header p{font-size:14px;opacity:.95;font-weight:300}
.content{padding:40px 30px}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:40px}
.metric-card{background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:25px;border-radius:10px;border-left:4px solid #667eea;transition:transform .3s ease,box-shadow .3s ease}
.metric-card:hover{transform:translateY(-2px);box-shadow:0 5px 15px rgba(102,126,234,.2)}
.metric-card.completed{border-left-color:#10b981}
.metric-card.cancelled{border-left-color:#f59e0b}
.metric-card.missed{border-left-color:#ef4444}
.metric-label{font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:8px}
.metric-value{font-size:32px;font-weight:700;color:#1f2937}
.metric-subtitle{font-size:12px;color:#9ca3af;margin-top:5px}
.section{margin-bottom:40px}
.section-title{font-size:18px;font-weight:700;color:#1f2937;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
.charts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px;margin-bottom:30px}
.chart-wrapper{background:#f9fafb;padding:20px;border-radius:10px;border:1px solid #e5e7eb}
.chart-wrapper h3{font-size:14px;font-weight:600;color:#374151;margin-bottom:15px;text-transform:uppercase;letter-spacing:.5px}
.chart-container{position:relative;height:250px}
table{width:100%;border-collapse:collapse;margin-top:15px}
thead{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff}
th{padding:15px;text-align:left;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.5px}
td{padding:16px 15px;border-bottom:1px solid #e5e7eb;font-size:14px}
tbody tr:nth-child(even){background:#f9fafb}
tbody tr:hover{background:#f3f4f6}
.status{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.status.concluido{background:#d1fae5;color:#065f46}
.status.faltou{background:#fee2e2;color:#7f1d1d}
.status.cancelado{background:#fef3c7;color:#78350f}
.status::before{content:'';display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor}
.valor{font-weight:600;color:#667eea}
.professional{font-weight:500;color:#1f2937}
.role{font-size:12px;color:#6b7280;font-weight:normal}
.stats-row{display:flex;gap:15px;font-size:13px;margin-top:15px;padding:15px;background:#f9fafb;border-radius:8px;flex-wrap:wrap}
.stat-item{display:flex;align-items:center;gap:8px}
.stat-label{color:#6b7280;font-weight:500}
.stat-value{color:#1f2937;font-weight:700}
.divider{width:1px;height:20px;background:#e5e7eb}
@media(max-width:768px){
  .metrics{grid-template-columns:1fr}
  .charts-grid{grid-template-columns:1fr}
  table{font-size:12px}
  th,td{padding:10px}
  .header-clinic{flex-direction:column;gap:20px}
  .clinic-info-right{text-align:left}
  .header{padding:25px 20px}
  .header h1{font-size:22px}
  .content{padding:20px}
  .patient-grid{grid-template-columns:1fr;gap:15px}
}
@media print{body{background:#fff;padding:0}.container{box-shadow:none;max-width:100%}}
</style>
</head>
<body>
<div class="container">
  <div class="header-clinic">
    <div class="clinic-info-left">
      <div class="clinic-logo">${(clinic_Name||'S')[0] ?? 'C'}</div>
      <div>
        <h2>${clinic_Name}</h2>
        <p>CNPJ: ${clinic_Cnpj}</p>
        <p>—</p>
        <p>—</p>
      </div>
    </div>
    <div class="clinic-info-right">
      <div class="prontuario-badge">
        <p class="prontuario-label">Documento de Prontuário</p>
        <h3>PRONTUÁRIO #${String(Math.floor(Math.random()*999999)).padStart(6,'0')}</h3>
      </div>
      <p class="data-geracao">Gerado em: ${todayStr}</p>
    </div>
  </div>

  <div class="patient-info">
    <h3>INFORMAÇÕES DO PACIENTE</h3>
    <div class="patient-grid">
      <div class="patient-field">
        <label>NOME</label>
        <p>${patientName}</p>
      </div>
      <div class="patient-field">
        <label>CPF</label>
        <p>${patientCpf}</p>
      </div>
      <div class="patient-field">
        <label>DATA DE NASCIMENTO</label>
        <p>${patientBirth}${patientAge ? ` (${patientAge})` : ''}</p>
      </div>
      <div class="patient-field">
        <label>TOTAL DE CONSULTAS</label>
        <p>${total}</p>
      </div>
      <div class="patient-field">
        <label>ÚLTIMA CONSULTA</label>
        <p>${lastDate}</p>
      </div>
      <div class="patient-field">
        <label>CELULAR / EMAIL</label>
        <p>${patientPhoneEmail}</p>
      </div>
    </div>
  </div>

  <div class="header">
    <h1>Relatório Detalhado do Paciente</h1>
    <p>Período: ${periodLabel}</p>
  </div>

  <div class="content">
    <div class="metrics">
      <div class="metric-card completed">
        <div class="metric-label">Atendimentos Concluídos</div>
        <div class="metric-value">${done}</div>
        <div class="metric-subtitle">de ${total} agendados (${attendRate}%)</div>
      </div>
      <div class="metric-card missed">
        <div class="metric-label">Não Compareceu</div>
        <div class="metric-value">${noshow}</div>
        <div class="metric-subtitle">—</div>
      </div>
      <div class="metric-card cancelled">
        <div class="metric-label">Cancelado</div>
        <div class="metric-value">${cancel}</div>
        <div class="metric-subtitle">—</div>
      </div>
      <div class="metric-card completed">
        <div class="metric-label">Valor Total</div>
        <div class="metric-value">${currency(totalValueDone)}</div>
        <div class="metric-subtitle">Média: ${currency(avg || 0)}/consulta</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Análise Visual</h2>
      <div class="charts-grid">
        <div class="chart-wrapper">
          <h3>Distribuição por Profissional (Valor Concluído)</h3>
          <div class="chart-container">
            <canvas id="professionalsChart"></canvas>
          </div>
        </div>
        <div class="chart-wrapper">
          <h3>Distribuição por Status</h3>
          <div class="chart-container">
            <canvas id="statusChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Histórico de Atendimentos</h2>

      <div class="stats-row">
        <div class="stat-item"><span class="stat-label">Total de Atendimentos:</span><span class="stat-value">${total}</span></div>
        <div class="divider"></div>
        <div class="stat-item"><span class="stat-label">Taxa de Comparecimento:</span><span class="stat-value">${attendRate}%</span></div>
        <div class="divider"></div>
        <div class="stat-item"><span class="stat-label">Profissionais Envolvidos:</span><span class="stat-value">${byProf.size || 0}</span></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Horário</th>
            <th>Profissional</th>
            <th>Serviço</th>
            <th>Status</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
  // Profissionais (doughnut)
  const profCtx = document.getElementById('professionalsChart').getContext('2d');
  new Chart(profCtx, {
    type: 'doughnut',
    data: {
      labels: ${JSON.stringify(profLabels)},
      datasets: [{
        data: ${JSON.stringify(profValues)},
        backgroundColor: ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#22c55e', '#a78bfa'],
        borderColor: 'white',
        borderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12, weight: '500' }, padding: 15, usePointStyle: true }
        }
      }
    }
  });

  // Status (pie)
  const statusCtx = document.getElementById('statusChart').getContext('2d');
  new Chart(statusCtx, {
    type: 'pie',
    data: {
      labels: ${JSON.stringify(statusLabels)},
      datasets: [{
        data: ${JSON.stringify(statusValues)},
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
        borderColor: 'white',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 12, weight: '500' }, padding: 15, usePointStyle: true }
        }
      }
    }
  });
</script>
</body>
</html>`;
}

/* ======================================================================
   Util: gera HTML para preview do RELATÓRIO GERAL (igual ao modelo do paciente)
====================================================================== */
function buildGeneralReportPreviewHTML(opts: {
  generatedAt: string;
  periodLabel: string;
  kpis: { concluded: number; total: number; revenue: number; expenses: number; profit: number; marginPct: number; };
  donut: { labels: string[]; values: number[] };
  pie:   { labels: string[]; values: number[] };
  table: Array<{ date: string; time?: string; professional?: string; professionalSpecialty?: string; service?: string; status?: string; price?: number|null }>;
}) {
  const { generatedAt, periodLabel, kpis, donut, pie, table } = opts;

  const rowsHtml = table.map(r => {
    const st = (r.status||'').toLowerCase();
    const cls =
      st.includes('concluido') ? 'concluido' :
      st.includes('no_show') || st.includes('faltou') ? 'faltou' :
      st.includes('cancelado') ? 'cancelado' : '';
    const lab =
      st.includes('concluido') ? '✓ Concluído' :
      st.includes('no_show') || st.includes('faltou') ? '⚠ Faltou' :
      st.includes('cancelado') ? '✕ Cancelado' : (r.status || '—');

    const prof = `${r.professional || '—'}${r.professionalSpecialty ? `<br><span class="role">${r.professionalSpecialty}</span>` : ''}`;

    return `
      <tr>
        <td>${fmtBR(r.date)}</td>
        <td>${r.time || '—'}</td>
        <td><span class="professional">${prof}</span></td>
        <td>${r.service || '—'}</td>
        <td><span class="status ${cls}">${lab}</span></td>
        <td class="valor">${r.price!=null ? currency(Number(r.price)) : '—'}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Relatório de Atendimentos</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg,#f5f7fa 0%,#c3cfe2 100%);padding:24px}
.container{max-width:1000px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.1);overflow:hidden}
.header{background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:26px 26px 18px;color:#fff}
.header h1{font-size:24px;font-weight:800;margin-bottom:6px}
.header .badge{display:inline-block;font-size:12px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);padding:6px 10px;border-radius:8px}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));gap:12px;padding:0 24px 18px;background:#4f46e5}
.kpi{background:#fff1;border-radius:10px;padding:12px;border:1px solid #ffffff44;backdrop-filter:blur(2px)}
.kpi h4{font-size:11px;opacity:.9;margin-bottom:4px}
.kpi .v{font-size:18px;font-weight:800}
.section-title{background:#6d28d9;color:#fff;padding:10px 16px;margin:16px 24px 0;border-radius:10px;font-weight:800}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 24px}
.card{border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fafafa}
.card h3{font-size:12px;font-weight:800;margin-bottom:10px}
.chart{position:relative;height:240px}
.mini{display:flex;gap:12px;justify-content:space-between;margin:0 24px 10px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px}
table{width:calc(100% - 48px);margin:0 24px 24px;border-collapse:collapse}
thead{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff}
th{padding:12px;text-align:left;font-size:12px}
td{padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px}
tbody tr:nth-child(even){background:#f9fafb}
.status{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700}
.status.concluido{background:#d1fae5;color:#065f46}
.status.faltou{background:#fee2e2;color:#7f1d1d}
.status.cancelado{background:#fef3c7;color:#78350f}
.valor{font-weight:700;color:#2563eb}
.role{font-size:11px;color:#6b7280}
.footer{color:#6b7280;font-size:12px;padding:0 24px 24px;text-align:right}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}.cards{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Relatório de Atendimentos</h1>
    <div>Período: ${periodLabel}</div>
    <div style="margin-top:8px"><span class="badge">Gerado em: ${generatedAt}</span></div>
  </div>

  <div class="kpis">
    <div class="kpi"><h4>Atendimentos Concluídos</h4><div class="v">${kpis.concluded}/${kpis.total}</div></div>
    <div class="kpi"><h4>Receita (Clínica)</h4><div class="v">${currency(kpis.revenue)}</div></div>
    <div class="kpi"><h4>Despesas</h4><div class="v">${currency(kpis.expenses)}</div></div>
    <div class="kpi"><h4>Lucro</h4><div class="v">${currency(kpis.profit)}</div></div>
    <div class="kpi"><h4>Margem</h4><div class="v">${kpis.marginPct.toFixed(1)}%</div></div>
  </div>

  <div class="section-title">Análise Visual</div>

  <div class="cards">
    <div class="card">
      <h3>Distribuição por Profissional (Valor Concluído)</h3>
      <div class="chart"><canvas id="donut"></canvas></div>
    </div>
    <div class="card">
      <h3>Distribuição por Status</h3>
      <div class="chart"><canvas id="pie"></canvas></div>
    </div>
  </div>

  <div class="section-title">Histórico de Atendimentos</div>
  <div class="mini">
    <div>Total de Atendimentos: <b>${kpis.total}</b></div>
    <div>Taxa de Comparecimento: <b>${(kpis.total ? Math.round((kpis.concluded/kpis.total)*100) : 0)}%</b></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>DATA</th><th>HORÁRIO</th><th>PROFISSIONAL</th><th>SERVIÇO</th><th>STATUS</th><th>VALOR</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="footer">Gerado em ${generatedAt}</div>
</div>

<script>
  const donut = new Chart(document.getElementById('donut').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ${JSON.stringify(donut.labels)}, datasets: [{ data: ${JSON.stringify(donut.values)}, borderWidth:2, borderColor:'#fff', backgroundColor: ['#6366F1','#10B981','#F59E0B','#EF4444','#A78BFA','#22C55E'] }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ usePointStyle:true }}}}
  });

  const pie = new Chart(document.getElementById('pie').getContext('2d'), {
    type: 'pie',
    data: { labels: ${JSON.stringify(pie.labels)}, datasets: [{ data: ${JSON.stringify(pie.values)}, borderWidth:2, borderColor:'#fff', backgroundColor:['#10B981','#EF4444','#F59E0B','#94A3B8'] }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ usePointStyle:true }}}}
  });
</script>
</body>
</html>`;
}


/* ======================================================================
   Hero Card (gradiente) + tiles
====================================================================== */
const Pill: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({ active, children, className, ...rest }) => (
  <button
    {...rest}
    className={[
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all",
      active ? "bg-white text-gray-900 border-white shadow"
             : "bg-transparent text-white border-white/20 hover:bg-white/10"
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

      {rangeMode === 'custom' && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-slate-900">
          <div className="bg-white/95 rounded-lg p-2">
            <DateInput label="De" value={from} onChange={setFrom} />
          </div>
          <div className="bg-white/95 rounded-lg p-2">
            <DateInput label="Até" value={to} onChange={setTo} />
          </div>
        </div>
      )}
    </div>

    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiTile title="Faturamento Bruto"   value={currency(Number(revenue.toFixed(2)))} icon={TrendingUp}/>
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

  // Preview (HTML) do relatório geral
const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
const [reportPreviewHtml, setReportPreviewHtml] = useState<string>('');
const iframeReportRef = useRef<HTMLIFrameElement>(null);


  // clínica (para o cabeçalho do preview HTML)
  const [clinicName, setClinicName] = useState<string>('Sua Clínica');
  const [clinicCnpj, setClinicCnpj]   = useState<string>('—');
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from('profiles')
          .select('clinic_name, clinic_cnpj')
          .eq('id', uid)
          .maybeSingle();
        if (data) {
          if (data.clinic_name) setClinicName(data.clinic_name);
          if (data.clinic_cnpj) setClinicCnpj(data.clinic_cnpj);
        }
      } catch {}
    })();
  }, []);

  const { professionals } = useProfessionals();
  const { transactions } = useTransactions();
  const { history } = useAppointmentHistory();
  const { /* slots */ } = useAppointmentJourneys();

  const myHistory      = useMemo(() => byOwner(history, uid),      [history, uid]);
  const myTransactions = useMemo(() => byOwner(transactions, uid), [transactions, uid]);

  // período — INICIAR em MÊS
  const [rangeMode, setRangeMode] = useState<RangeMode>('month');
  const [from, setFrom] = useState(() => {
    const now = new Date();
    return toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [to, setTo] = useState(() => {
    const now = new Date();
    return toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
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

  // histórico do período
  const rangeHistory = useMemo(
    () => myHistory.filter(h => (h.date ?? '') >= from && (h.date ?? '') <= to),
    [myHistory, from, to]
  );
  const completedRangeHistory = useMemo(
    () => rangeHistory.filter(h => isDone(h.status)), [rangeHistory]
  );

  /* ======= Transações do período ======= */
  const rangeTransactionsAll = useMemo(() => {
    return myTransactions.filter((t) => {
      const dateStr =
        (t as any)?.date ??
        (t as any)?.created_at ??
        (t as any)?.createdAt;
      const d = parseStrDate(dateStr);
      return !!d && isWithin(d, from, to);
    });
  }, [myTransactions, from, to]);

  const { expenses: totalExpenses } = useMemo(() => {
    let revenue = 0;
    let expenses = 0;

    for (const t of rangeTransactionsAll) {
      const raw = (t as any)?.amount;
      const val = parseAmountBR(raw);
      const type = String((t as any)?.type || '').toLowerCase();

      if (type === 'income') {
        if (val >= 0) revenue += val; else expenses += Math.abs(val);
        continue;
      }
      if (type === 'expense') {
        expenses += Math.abs(val);
        continue;
      }
      if (val > 0) revenue += val;
      else if (val < 0) expenses += Math.abs(val);
    }

    return { revenue, expenses };
  }, [rangeTransactionsAll]);

  // faturamento bruto (somente concluídos)
  const grossBilling = useMemo(
    () => completedRangeHistory.reduce((s, h) => s + (Number((h as any).price) || 0), 0),
    [completedRangeHistory]
  );
  const clinicRevenue = useMemo(
    () => completedRangeHistory.reduce((s, h) => {
      const price = Number((h as any).price) || 0;
      const pct   = Number((h as any).clinicPercentage) || 0;
      return s + (price * (pct / 100));
    }, 0),
    [completedRangeHistory]
  );

  const profitMargin = useMemo(() => {
    if (clinicRevenue <= 0) return '0.0';
    const m = ((clinicRevenue - totalExpenses) / clinicRevenue) * 100;
    return m.toFixed(1);
  }, [clinicRevenue, totalExpenses]);

  const uniquePatients = useMemo(() =>
    new Set(rangeHistory.map(h => (h.patientName ?? '').toString().toLowerCase())).size
  , [rangeHistory]);

  const completionRate = useMemo(() => {
    const total = rangeHistory.length, done = completedRangeHistory.length;
    return total > 0 ? ((done / total) * 100).toFixed(1) : '0.0';
  }, [rangeHistory, completedRangeHistory]);

  // comissões e resumo por profissional (apenas concluídos)
  const commissionsForClinic = useMemo(() =>
    completedRangeHistory.reduce((s, h) => s + (Number((h as any).price)||0) * ((Number((h as any).clinicPercentage)||0)/100), 0)
  , [completedRangeHistory]);

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

  // Preview do PDF de atendimentos (ReportDocument)

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
          status: (h.status ?? '').toLowerCase(),
        };
      });

    setPatientModalName(name);
    setPatientVisits(visits);
    setPatientModalOpen(true);
  };

  // PDF geral (lista do período)
const handleExportPdf = async () => {
  const range = rangeHistory;

  // agregações para o resumo
  const byStatus: Record<string, number> = {};
  let revenueClinic = 0;

  for (const h of range) {
    const st = (h.status ?? '').toLowerCase();
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (isDone(st)) {
      const price = Number(h.price) || 0;
      const clinicPct = Number((h as any).clinicPercentage) || 0;
      revenueClinic += price * (clinicPct / 100);
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
      professionalSpecialty: (h as any).professionalSpecialty,
      service: (h as any).service ?? '—',
      patient: h.patientName || undefined,
      status: (h.status ?? ''),
      price: Number(h.price) || null,
    }));

  // dados para os gráficos (donut por profissional - só concluídos)
  const doneRows = rows.filter(r => (r.status || '').toLowerCase().includes('concluido'));
  const byProf = new Map<string, number>();
  for (const r of doneRows) {
    const label = `${r.professional || '—'}${r.professionalSpecialty ? ` (${r.professionalSpecialty})` : ''}`;
    byProf.set(label, (byProf.get(label) || 0) + (Number(r.price) || 0));
  }
  const donut = { labels: Array.from(byProf.keys()), values: Array.from(byProf.values()) };

  // pizza por status
  const pie = {
    labels: ['Concluído', 'Faltou', 'Cancelado', 'Outros'],
    values: [
      byStatus['concluido'] || 0,
      byStatus['no_show'] || 0,
      byStatus['cancelado'] || 0,
      Math.max(0, rows.length - ((byStatus['concluido']||0)+(byStatus['no_show']||0)+(byStatus['cancelado']||0)))
    ]
  };

  // KPIs
  const kpis = {
    concluded: byStatus['concluido'] || 0,
    total: rows.length,
    revenue: revenueClinic,
    expenses: totalExpenses,
    profit: revenueClinic - totalExpenses,
    marginPct: revenueClinic > 0 ? ((revenueClinic - totalExpenses) / revenueClinic) * 100 : 0,
  };

  // --- PREVIEW HTML no modal ---
  const html = buildGeneralReportPreviewHTML({
    generatedAt: new Date().toLocaleString('pt-BR'),
    periodLabel,
    kpis,
    donut,
    pie,
    table: rows,
  });

  setReportPreviewHtml(html);
  setReportPreviewOpen(true);

  // Dica: o PDF REAL será gerado só quando clicar em "Baixar PDF" dentro do modal.
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
        revenue={grossBilling}
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

      {/* CARDS */}
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
                  {p.name}
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

                <div className="mt-3 h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${bar * 100}%` }} />
                </div>

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
        clinic_Name={clinicName}
        clinic_Cnpj={clinicCnpj}
      />

{/* ===== Modal de Pré-visualização do PDF (Relatório Geral) ===== */}
{reportPreviewOpen && (
  <div
    className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3"
    onClick={() => setReportPreviewOpen(false)}
  >
    <div
      className="bg-white rounded-xl w-full max-w-[1120px] max-h-[95vh] overflow-hidden shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-3 sm:px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Pré-visualização do PDF</div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              // gera o PDF real usando o ReportDocument e baixa
              const range = rangeHistory;
              const byStatus: Record<string, number> = {};
              let revenue = 0;
              for (const h of range) {
                const st = (h.status ?? '').toLowerCase();
                byStatus[st] = (byStatus[st] || 0) + 1;
                if (isDone(st)) {
                  const price = Number(h.price) || 0;
                  const clinicPct = Number((h as any).clinicPercentage) || 0;
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
                  professionalSpecialty: (h as any).professionalSpecialty,
                  service: (h as any).service ?? '—',
                  patient: h.patientName || undefined,
                  status: (h.status ?? ''),
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

              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `relatorio_${from}_a_${to}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
          >
            Baixar PDF
          </button>

          <button
            onClick={() => {
              const w = window.open('', '_blank');
              if (!w) return;
              w.document.open();
              w.document.write(reportPreviewHtml);
              w.document.close();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
            title="Visualizar em nova guia"
          >
            Visualizar
          </button>

          <button
            onClick={() => {
              const win = iframeReportRef.current?.contentWindow;
              if (!win) return;
              setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 150);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
            title="Imprimir"
          >
            Imprimir
          </button>

          <button
            onClick={() => setReportPreviewOpen(false)}
            className="px-3 py-1.5 text-sm text-blue-600 hover:underline"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Área de visualização (HTML) */}
      <iframe
        ref={iframeReportRef}
        title="Pré-visualização do Relatório"
        srcDoc={reportPreviewHtml}
        className="w-full h-[85vh] border-0"
      />
    </div>
  </div>
)}


    </div>
  );
};

export default Reports;

/* ======================================================================
   Modais (PatientsModal mantido) + PatientDetailsModal com PREVIEW interno
====================================================================== */
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
  clinic_Name?: string; clinic_Cnpj?: string;
}> = ({ open, onClose, patientName, periodLabel, visits, clinic_Name, clinic_Cnpj }) => {
  const total = visits.length;
  const totalValue = visits.filter(v => (v.status||'').toLowerCase()==='concluido')
                           .reduce((s, v) => s + (Number(v.price) || 0), 0);

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

  // ======= Pré-visualização interna (iframe) =======
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // abre a pré-visualização com o mesmo HTML do preview
  const openPreview = () => {
    const html = buildPatientPreviewHTML({
      clinic_Name,
      clinic_Cnpj,
      patientName,
      periodLabel,
      visits,
    });
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4">
      <div className="mt-10 w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">{patientName}</h3>
            <p className="text-xs text-gray-500">Período: {periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
              title="Baixar PDF"
            >
              <Download size={16} /> Baixar PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
          </div>
        </div>

        {/* KPIs */}
        <div className="px-5 py-3 border-b grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-gray-500">Atendimentos (todos)</div>
            <div className="text-gray-900 font-semibold text-lg">{total}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-gray-500">Valor total (concluídos)</div>
            <div className="text-gray-900 font-semibold text-lg">{currency(totalValue)}</div>
          </div>
        </div>

        {/* Resumo por profissional */}
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

        {/* Lista (scrollável com folga inferior) */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y px-5 py-3 pb-[calc(env(safe-area-inset-bottom)+120px)]">
          {visits.map((v, i) => (
            <div key={i} className="py-3">
              <div className="text-sm text-gray-500">{fmtBR(v.date)} • {v.time}</div>
              <div className="font-medium text-gray-900">{v.professional || '—'}</div>
              {v.professionalSpecialty && (
                <div className="text-xs text-gray-500 -mt-0.5 mb-1">{v.professionalSpecialty}</div>
              )}
              <div className="text-sm text-gray-700">{v.service || '—'}</div>
              <div className="text-sm text-gray-900">
                {v.price != null ? currency(Number(v.price)) : '—'}
                {!!v.status && (
                  <span className="ml-2 text-xs text-gray-600">
                    • {STATUS_LABEL_PT[(v.status||'').toLowerCase()] ?? v.status}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="h-6" />
        </div>
      </div>

      {/* ===== Modal interno de Pré-visualização (iframe) ===== */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-[1120px] max-h-[95vh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b px-3 sm:px-4 py-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Pré-visualização do PDF</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.open();
                    w.document.write(previewHtml);
                    w.document.close();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
                  title="Visualizar em nova guia"
                >
                  Visualizar
                </button>

                <button
                  onClick={() => {
                    const win = iframeRef.current?.contentWindow;
                    if (!win) return;
                    setTimeout(() => { try { win.focus(); win.print(); } catch(e) {} }, 200);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm hover:bg-gray-50"
                  title="Imprimir"
                >
                  Imprimir
                </button>

                <button
                  onClick={() => {
                    const win = iframeRef.current?.contentWindow;
                    if (!win) return;
                    setTimeout(() => { try { win.focus(); win.print(); } catch(e) {} }, 200);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                  title="Baixar PDF"
                >
                  Baixar PDF
                </button>

                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:underline"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Área de visualização */}
            <iframe
              ref={iframeRef}
              title="Pré-visualização do Relatório"
              srcDoc={previewHtml}
              className="w-full h-[80vh] border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};
