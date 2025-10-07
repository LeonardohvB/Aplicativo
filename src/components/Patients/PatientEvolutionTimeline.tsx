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

/* ====== Tipografia dos rótulos de sessão ====== */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
      {children}
    </div>
  );
}

/* pill de sintomas (laranja suave) */
function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-amber-50 text-amber-700">
      {children}
    </span>
  );
}

/* bloco com borda sutil */
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/* ================= vitais ================= */
function VitalGroup({
  items,
}: {
  items: Array<{ icon: React.ReactNode; label: string; value?: string }>;
}) {
  const visible = items.filter((i) => i.value && String(i.value).trim().length);
  if (!visible.length) return null;

  // até 5 por linha; se tiver mais, quebra para a linha de baixo
  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
      <div className="grid gap-3 grid-cols-4 sm:grid-cols-5">
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
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 leading-tight">
        <div className="text-sm font-semibold text-gray-800">{num}</div>
        {unit && <div className="text-[10px] text-gray-500">{unit}</div>}
      </div>
    </div>
  );
}

/* ================ componente ================ */
export default function PatientEvolutionTimeline({ patientId }: { patientId: string }) {
  const { data, loading, error } = usePatientEvolutionFeed(patientId);

  if (loading) return <div className="text-sm text-gray-600">Carregando…</div>;
  if (error) return <div className="text-sm text-red-600">Falha ao carregar a evolução.</div>;
  if (!data?.length) return <div className="text-sm text-gray-600">Sem evoluções por aqui ainda.</div>;

  return (
    <div className="relative -ml-4 sm:-ml-6">
      {/* linha guia da timeline */}
      <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-slate-200" />
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
            <div className="relative flex flex-nowrap items-start gap-3 md:gap-4" key={item.id}>
              {/* avatar/icon da timeline */}
              <div className="pt-1 w-10 shrink-0">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center ring-4 ring-white">
                  <Stethoscope className="w-5 h-5" />
                </div>
              </div>

              {/* cartão */}
              <div className="flex-1 min-w-0 -ml-1 md:-ml-3 relative overflow-hidden group">
                {/* ações (reveal on swipe) mantidas */}
                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center pr-4 gap-3 bg-transparent z-10 translate-x-full group-[.show]:translate-x-0 transition-transform duration-300 ease-in-out pointer-events-none">
                  <button
                    className="h-14 w-14 grid place-items-center text-white rounded-2xl bg-indigo-600 shadow-xl ring-1 ring-black/5 hover:bg-indigo-700 transition pointer-events-auto"
                    title="Editar evolução"
                    onClick={() => alert("Em breve: editar evolução")}
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    className="h-14 w-14 grid place-items-center text-white rounded-2xl bg-red-600 shadow-xl ring-1 ring-black/5 hover:bg-red-700 transition pointer-events-auto"
                    title="Excluir evolução"
                    onClick={() => alert("Em breve: excluir evolução")}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* card arrastável */}
                <div
                  className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm transform transition-transform duration-300 ease-in-out group-[.show]:-translate-x-20"
                  onTouchStart={(e) => {
                    (e.currentTarget as any).dataset.startX = e.touches[0].clientX.toString();
                  }}
                  onTouchEnd={(e) => {
                    const startX = parseFloat((e.currentTarget as any).dataset.startX || "0");
                    const endX = e.changedTouches[0].clientX;
                    const delta = startX - endX;
                    if (delta > 30) e.currentTarget.parentElement?.classList.add("show");
                    if (delta < -30) e.currentTarget.parentElement?.classList.remove("show");
                  }}
                  onMouseDown={(e) => {
                    (e.currentTarget as any).dataset.startX = e.clientX.toString();
                  }}
                  onMouseUp={(e) => {
                    const startX = parseFloat((e.currentTarget as any).dataset.startX || "0");
                    const endX = e.clientX;
                    const delta = startX - endX;
                    if (delta > 30) e.currentTarget.parentElement?.classList.add("show");
                    if (delta < -30) e.currentTarget.parentElement?.classList.remove("show");
                  }}
                >
                  {/* ======= header ======= */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      {/* título */}
                      <div className="text-lg font-bold text-gray-900">
                        {item.title || "Consulta de Acompanhamento"}
                      </div>

                      {/* subheader: data (linha 1) + hora (linha 2) à esquerda; profissional à direita */}
                      <div className="mt-0.5 flex items-start justify-between text-sm text-gray-600 font-normal flex-wrap gap-x-3 gap-y-1">
                        {/* data + hora em 2 linhas */}
                        <div className="inline-flex items-start gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-400 mt-[2px]" />
                          <div className="leading-tight">
                            <div>{fmtDate(item.occurred_at)}</div>
                            <div className="text-[13px]">{fmtTime(item.occurred_at)}</div>
                          </div>
                        </div>

{/* profissional à direita (profissão em cima, nome embaixo) */}
{item.professional_name && (
  <span className="inline-flex items-start gap-2 ml-auto">
    <User2 className="w-4 h-4 text-slate-400 mt-[2px]" />
    <span className="leading-tight text-right">
      {/* profissão/especialidade */}
      {item.specialty && (
        <div
          className="text-[11px] text-gray-500 truncate"
          title={String(item.specialty)}
        >
          {item.specialty}
        </div>
      )}
      {/* nome */}
      <div className="font-normal text-gray-600">
        {item.professional_name}
      </div>
    </span>
  </span>
)}


                      </div>
                    </div>
                  </div>

                  {/* ======= vitais ======= */}
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

                  {/* ======= conteúdo ======= */}
                  {(hasSOAP || meds.length > 0) && (
                    <div className="mt-4 space-y-4">
                      {/* sintomas & diagnóstico */}
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
                            <div className="text-sm text-gray-500">—</div>
                          )}
                        </div>

                        <div>
                          <SectionTitle>Diagnóstico</SectionTitle>
                          {item.diagnosis?.length ? (
                            <div className="text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {item.diagnosis.join("\n")}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">—</div>
                          )}
                        </div>
                      </div>

                      {/* conduta */}
                      {item.conduct && <Box title="Conduta">{item.conduct}</Box>}

                      {/* medicações */}
                      {meds.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <SectionTitle>Medicações</SectionTitle>
                          <ul className="space-y-2">
                            {meds.map((m, i) => (
                              <li
                                key={`${item.id}-med-${i}`}
                                className="flex items-start gap-2 rounded-xl bg-violet-50 text-violet-900 p-2"
                              >
                                <PillIcon className="w-4 h-4 mt-0.5" />
                                <div className="text-sm">
                                  <div className="font-semibold text-gray-800">{m.name}</div>
                                  {(m.freq || m.duration) && (
                                    <div className="text-[12px] text-gray-700/80">
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

                      {/* observações */}
                      {item.observations && (
                        <div>
                          <SectionTitle>Observações</SectionTitle>
                          <div className="text-sm font-normal text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {item.observations}
                          </div>
                        </div>
                      )}

                      {/* próximos passos */}
                      {item.next_steps && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-blue-500" />
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Próximos passos
                            </div>
                          </div>
                          <div className="mt-1 text-sm font-normal text-gray-800 whitespace-pre-wrap leading-relaxed">
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
