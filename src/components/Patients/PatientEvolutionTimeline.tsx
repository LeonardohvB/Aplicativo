// src/components/Patients/PatientEvolutionTimeline.tsx
import React from "react";
import {
  CalendarDays,
  User2,
  Pill as PillIcon,
  ClipboardList,
  Activity,
  Thermometer,
  Scale,
  Ruler,
  Edit3,
  Trash2,
  Stethoscope,
} from "lucide-react";
import { usePatientEvolutionFeed, EvolutionItem } from "../../hooks/usePatientEvolutionFeed";

/* ================= helpers ================= */
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function splitUnit(v: string): [string, string] {
  const m = v.trim().match(/^(\d+(?:[\.,]\d+)?(?:\/\d+(?:[\.,]\d+)?)?)\s*(.*)$/);
  if (!m) return [v, ""];
  return [m[1], m[2] || ""];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-wide text-slate-500 mb-1">
      {children}
    </div>
  );
}
function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700">
      {children}
    </span>
  );
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="text-sm text-slate-800 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

/* ===== vitais: faixa cinza com grid auto-fit (quebra automático) ===== */
function VitalGroup({
  items,
}: {
  items: Array<{ icon: React.ReactNode; label: string; value?: string }>;
}) {
  const visible = items.filter((i) => i.value && String(i.value).trim().length);
  if (!visible.length) return null;

  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(90px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(110px,1fr))]">
        {visible.map((it, i) => (
          <VitalInline key={`vital-${i}`} icon={it.icon} label={it.label} value={it.value!} />
        ))}
      </div>
    </div>
  );
}

function VitalInline({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [num, unit] = splitUnit(value);

  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 leading-tight">
        <div className="text-[12px] sm:text-[14px] font-semibold text-slate-900">{num}</div>
        {unit && <div className="text-[10px] text-slate-600">{unit}</div>}
      </div>
    </div>
  );
}

/* ================ component ================ */
export default function PatientEvolutionTimeline({ patientId }: { patientId: string }) {
  const { data, loading, error } = usePatientEvolutionFeed(patientId);

  if (loading) return <div className="text-sm text-gray-600">Carregando…</div>;
  if (error) return <div className="text-sm text-red-600">Falha ao carregar a evolução.</div>;
  if (!data?.length) return <div className="text-sm text-gray-600">Sem evoluções por aqui ainda.</div>;

  return (
    // puxa levemente a timeline para a esquerda para ganhar espaço
    <div className="relative -ml-4 sm:-ml-6">
      {/* trilho mais à esquerda para acompanhar a pílula */}
      <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-slate-200" />

      {/* padding à esquerda mínimo para o conteúdo não colar no trilho */}
      <div className="space-y-6 pl-1 sm:pl-2">
        {data.map((item: EvolutionItem) => {
          const v = item.vitals || {};
          const meds = item.medications || [];
          const hasVitals = v.bp || v.hr || v.temp || v.weight || v.height;
          const hasSOAP =
            (item.symptoms?.length ?? 0) > 0 ||
            (item.diagnosis?.length ?? 0) > 0 ||
            !!item.conduct ||
            !!item.observations ||
            meds.length > 0 ||
            !!item.next_steps;

          return (
            // gap reduzido e card levemente sobreposto para a esquerda
            <div key={item.id} className="relative flex gap-2">
              {/* avatar timeline puxado um pouco para a esquerda */}
              <div className="shrink-0 pt-1 -ml-0 sm:-ml-2">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center ring-4 ring-white">
                  <Stethoscope className="w-5 h-5" />
                </div>
              </div>

              {/* card branco avançando mais para a esquerda */}
              <div className="flex-1 -ml-1 sm:-ml-3">
                <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
                  {/* header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-lg font-semibold text-slate-900">
                        {item.title || "Consulta de Acompanhamento"}
                      </div>

                      <div className="flex items-start justify-between text-xs text-slate-600 flex-wrap gap-x-3 gap-y-1">
                        <div className="inline-flex items-center gap-1">
                          <CalendarDays className="w-4 h-4 text-slate-400" />
                          {(() => {
                            const d = new Date(item.occurred_at);
                            if (isNaN(d.getTime())) return "—";
                            const date = d.toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            });
                            const time = d.toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            return `${date} às ${time}`;
                          })()}
                        </div>

                        <div className="flex flex-col items-start text-right sm:items-end gap-0.5">
                          {item.specialty && (
                            <span className="inline-flex items-center self-end rounded-lg bg-sky-50 text-sky-700 px-2 py-0.5 text-[11px] font-medium">
                              {item.specialty}
                            </span>
                          )}
                          {item.professional_name && (
                            <span className="inline-flex items-center gap-1">
                              <User2 className="w-4 h-4 text-slate-400" />
                              <span className="font-medium text-slate-800">
                                {item.professional_name}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ações */}
                    <div className="flex items-center gap-1 text-slate-500">
                      <button
                        className="p-2 rounded-lg hover:bg-slate-50"
                        title="Editar evolução"
                        onClick={() => alert("Em breve: editar evolução")}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg hover:bg-slate-50"
                        title="Excluir evolução"
                        onClick={() => alert("Em breve: excluir evolução")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* vitais */}
                  {hasVitals && (
                    <VitalGroup
                      items={[
                        { icon: <Activity className="w-4 h-4 text-slate-400" />, label: "Pressão", value: v.bp },
                        { icon: <Activity className="w-4 h-4 text-slate-400" />, label: "FC", value: v.hr },
                        { icon: <Thermometer className="w-4 h-4 text-slate-400" />, label: "Temp.", value: v.temp },
                        { icon: <Scale className="w-4 h-4 text-slate-400" />, label: "Peso", value: v.weight },
                        { icon: <Ruler className="w-4 h-4 text-slate-400" />, label: "Altura", value: v.height },
                      ]}
                    />
                  )}

                  {/* conteúdo */}
                  {hasSOAP && (
                    <div className="mt-4 space-y-4">
                      {/* sintomas + diagnóstico */}
                      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                        <div>
                          <SectionTitle>Sintomas</SectionTitle>
                          {item.symptoms?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {item.symptoms.map((t, i) => (
                                <TagPill key={`${item.id}-sym-${i}`}>{t}</TagPill>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">—</div>
                          )}
                        </div>

                        <div>
                          <SectionTitle>Diagnóstico</SectionTitle>
                          {item.diagnosis?.length ? (
                            <div className="text-sm text-slate-800 whitespace-pre-wrap">
                              {item.diagnosis.join("\n")}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-500">—</div>
                          )}
                        </div>
                      </div>

                      {item.conduct && <Box title="Conduta">{item.conduct}</Box>}

                      {meds.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <SectionTitle>Medicações</SectionTitle>
                          <ul className="space-y-2">
                            {meds.map((m, i) => (
                              <li
                                key={`${item.id}-med-${i}`}
                                className="flex items-start gap-2 rounded-xl bg-violet-50 text-violet-800 p-2"
                              >
                                <PillIcon className="w-4 h-4 mt-0.5" />
                                <div className="text-sm">
                                  <div className="font-medium">{m.name}</div>
                                  {(m.freq || m.duration) && (
                                    <div className="text-[12px] opacity-90">
                                      {m.freq ?? ""}
                                      {m.freq && m.duration ? " • " : ""}
                                      {m.duration ?? ""}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {item.observations && <Box title="Observações">{item.observations}</Box>}

                      {item.next_steps && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-slate-400" />
                            <div className="text-[11px] font-semibold tracking-wide text-slate-500">
                              Próximos passos
                            </div>
                          </div>
                          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">
                            {item.next_steps}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
