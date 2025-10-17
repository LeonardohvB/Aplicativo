// src/pages/ProfessionalsArchived.tsx
import { useMemo, useState } from 'react';
import { useProfessionals, RefetchOpts } from '../hooks/useProfessionals';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import { ArrowLeft, RotateCcw } from 'lucide-react';

function ReactivatePill({
  onClick,
  loading = false,
}: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Reativar este profissional"
      className={[
        "inline-flex items-center gap-2 rounded-full",
        "border border-emerald-200 px-3 py-1.5 text-sm font-medium",
        loading ? "bg-emerald-50 text-emerald-700 opacity-70 cursor-default"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer",
        "transition active:scale-[0.98] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
      ].join(" ")}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
        ) : (
          <RotateCcw size={14} className="text-emerald-700" />
        )}
      </span>
      {loading ? "Reativando…" : "Reativar"}
    </button>
  );
}

export default function ProfessionalsArchived() {
  // ⬇️ já busca SOMENTE arquivados no primeiro carregamento
  const initial: RefetchOpts = { onlyArchived: true };
  const { professionals, refetch, restoreProfessional, loading } = useProfessionals(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  // segurança extra: caso em algum momento o estado seja “misto”,
  // garantimos que só renderize arquivados.
  const archivedList = useMemo(
    () => professionals.filter(p => p.isArchived),
    [professionals]
  );

  const noop = () => {};
  const noopPhoto = async (_id: string, _f: File) => {};

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Profissionais desativados
          </h1>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            title="Voltar"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mx-1 rounded-xl border border-dashed border-gray-300 bg-white/60 p-4 text-center text-gray-500">
          Carregando…
        </div>
      ) : archivedList.length === 0 ? (
        <div className="mx-1 rounded-xl border border-dashed border-gray-300 bg-white/60 p-4 text-center text-gray-500">
          Nenhum profissional arquivado.
        </div>
      ) : (
        <div className="space-y-4">
          {archivedList.map((p) => (
            <div key={p.id} className="group">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
                <ProfessionalCard
                  professional={p}
                  onToggle={noop}
                  onEdit={noop}
                  onDelete={noop}
                  onPhotoChange={noopPhoto}
                />
                <div className="px-3 pb-3 flex justify-end">
                  <ReactivatePill
                    loading={busyId === p.id}
                    onClick={async () => {
                      try {
                        setBusyId(p.id);
                        await restoreProfessional(p.id);
                        await refetch({ onlyArchived: true });
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
