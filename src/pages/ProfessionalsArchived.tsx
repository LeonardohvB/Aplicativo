import { useMemo, useState } from 'react';
import { useProfessionals, RefetchOpts } from '../hooks/useProfessionals';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useConfirm } from '../providers/ConfirmProvider';

type Props = { onBack?: () => void };

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

export default function ProfessionalsArchived({ onBack }: Props) {
  const confirm = useConfirm();

  // apenas arquivados
  const initial: RefetchOpts = { onlyArchived: true };
  const { professionals, refetch, restoreProfessional, loading } = useProfessionals(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const archivedList = useMemo(
    () => professionals.filter((p) => p.isArchived),
    [professionals]
  );

  const noop = () => {};
  const noopPhoto = async (_id: string, _f: File) => {};

  const handleBack = () => {
    if (onBack) return onBack();
    // fallback leve (sem recarregar): tenta histórico
    if (window.history.length > 1) window.history.back();
  };

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* topo — igual ao Profile */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
          title="Voltar"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-center text-gray-900">Profissionais desativados</h1>
        <div className="w-[64px]" />
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
                      const ok = await confirm({
                        title: 'Reativar profissional?',
                        description: (
                          <span>
                            Tem certeza que deseja reativar <strong>{p.name}</strong>?<br />
                            Ele voltará a aparecer na lista de profissionais ativos.
                          </span>
                        ),
                        confirmText: 'Reativar',
                        cancelText: 'Cancelar',
                        variant: 'primary',
                      });
                      if (!ok) return;

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
