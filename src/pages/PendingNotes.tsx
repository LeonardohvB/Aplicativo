import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Row = {
  id: string;                // PK do histórico OU do agendamento (ajuste se for appointment_id)
  appointment_id?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  patient_name?: string | null;
  professional_name?: string | null;
  service?: string | null;
};

export default function PendingNotes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // pegue os campos que você tiver na sua tabela:
    const { data, error } = await supabase
      .from("appointment_history")
      .select("id, appointment_id, date, start_time, end_time, patient_name, professional_name, service, note_status")
      .eq("note_status", "pending")
      .order("date", { ascending: false })
      .limit(100);
    if (!error) setRows(data as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const openEncounter = (r: Row) => {
    window.dispatchEvent(new CustomEvent("encounter:open", {
      detail: {
        appointmentId: r.id || r.appointment_id,
        patientName: r.patient_name || undefined,
        professionalName: r.professional_name || undefined,
        serviceName: r.service || undefined,
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Notas a concluir</h1>
          <button onClick={load} className="px-3 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900">
            Recarregar
          </button>
        </div>

        {loading && <div className="text-slate-500">Carregando…</div>}

        {!loading && rows.length === 0 && (
          <div className="text-slate-500">Sem pendências 🎉</div>
        )}

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-white border rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-slate-900 font-medium truncate">{r.patient_name || "Paciente"}</div>
                <div className="text-sm text-slate-600 truncate">
                  {r.professional_name || "Profissional"} • {r.service || "Consulta"}
                </div>
                <div className="text-xs text-slate-500 tabular-nums">
                  {r.date} • {r.start_time}–{r.end_time}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEncounter(r)}
                  className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Abrir prontuário
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
