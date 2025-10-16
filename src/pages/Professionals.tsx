// src/pages/Professionals.tsx
import React, { useEffect, useState } from 'react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import SwipeRow from '../components/common/SwipeRow';
import { RotateCcw } from 'lucide-react';
// padrões globais
import { useConfirm } from '../providers/ConfirmProvider';
import { useToast } from '../components/ui/Toast';
import { Trash2 } from 'lucide-react';

/* ======== Toggle bonito (fix overflow/align) ======== */
function PrettyToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={[
        "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition shadow-sm",
        checked
          ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
          : "bg-white border-gray-200 hover:bg-gray-50"
      ].join(" ")}
    >
      {/* trilha do switch */}
      <span
        className={[
          "relative inline-block h-5 w-9 rounded-full overflow-hidden align-middle",
          "transition-colors duration-200 ease-in-out",
          checked ? "bg-emerald-500" : "bg-gray-300"
        ].join(" ")}
        aria-hidden="true"
      >
        {/* knob */}
        <span
          className={[
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white",
            "transition-transform duration-200 ease-in-out will-change-transform",
            checked ? "translate-x-4" : "translate-x-0"
          ].join(" ")}
        />
      </span>

      {/* ícone e textos */}
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        className={checked ? "text-emerald-700" : "text-gray-500"}
        aria-hidden="true"
      >
        <path fill="currentColor" d="M20 6h-4V4H8v2H4v14h16V6Zm-6 0H10V5h4v1Z"/>
      </svg>

      <span className={["text-sm font-medium", checked ? "text-emerald-800" : "text-gray-700"].join(" ")}>
        {label}
      </span>

      {checked && (
        <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <svg width="14" height="14" viewBox="0 0 24 24" className="text-emerald-700" aria-hidden="true">
            <path fill="currentColor" d="M9 16.2 4.8 12l1.4-1.4L9 13.4l8.8-8.8L19.2 6 9 16.2z"/>
          </svg>
          ativo
        </span>
      )}
    </button>
  );
}

/* ======== Botão premium: Reativar (pill) ======== */
function ReactivatePill({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
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


const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  // Mostrar SOMENTE arquivados quando true
  const [showAll, setShowAll] = useState(false);

  const confirm = useConfirm();
  const { success, error } = useToast();
  

  const {
    professionals,
    loading,
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
    archiveProfessional,
    restoreProfessional,
    refetch,                 // aceita { onlyArchived?: boolean }
  } = useProfessionals();

  const openEditById = (id: string) => {
    const professional = professionals.find((p) => p.id === id);
    if (professional) {
      setEditingProfessional(professional);
      setIsEditModalOpen(true);
    }
  };

  // Abre cadastro quando o menu dispara o evento global
  useEffect(() => {
    const open = () => setIsModalOpen(true);
    window.addEventListener('professionals:add', open);
    return () => window.removeEventListener('professionals:add', open);
  }, []);

  // carrega na montagem (não inclua `refetch` nas deps para evitar loop)
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // troca a origem dos dados conforme o checkbox (sem `refetch` nas deps)
  useEffect(() => {
    if (showAll) {
      refetch({ onlyArchived: true });
    } else {
      refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  const handleAdd = async (newProfessional: {
    name: string;
    cpf: string;
    specialty: string;
    phone: string;
    registrationCode: string;
    commissionRate?: number;
  }) => {
    await addProfessional(newProfessional as any);
    setIsModalOpen(false);
    showAll ? refetch({ onlyArchived: true }) : refetch();
  };

  const handleUpdate = async (
    id: string,
    updates: {
      name?: string;
      specialty?: string;
      phone?: string;
      registrationCode?: string;
      commissionRate?: number;
      isActive?: boolean;
    }
  ) => {
    await updateProfessional(id, updates as any);
    setIsEditModalOpen(false);
    setEditingProfessional(null);
    showAll ? refetch({ onlyArchived: true }) : refetch();
  };

  // Confirmação para ARQUIVAR (em vez de excluir)
  const askAndArchive = async (id: string) => {
    const prof = professionals.find(p => p.id === id);
    const ok = await confirm({
      title: 'Desativar profissional?',
      description: (
        <>
          Isso irá inativar e esconder <b>{prof?.name ?? 'este profissional'}</b> da lista padrão.
          O histórico será preservado. Você pode reativar depois.
        </>
      ),
      confirmText: 'Desativar',
      cancelText: 'Cancelar',
      variant: 'danger',
      icon: <Trash2 className="w-5 h-5" />,
    });
    if (!ok) return;

    try {
      await archiveProfessional(id);
      success('Profissional arquivado.');
    } catch (e) {
      console.error(e);
      error('Não foi possível arquivar o profissional.');
    } finally {
      setIsEditModalOpen(false);
      setEditingProfessional(null);
      setSwipeOpenId(null);
      showAll ? refetch({ onlyArchived: true }) : refetch();
    }
  };

  // Excluir (hard delete) continua disponível (não usado por padrão)
  const askAndDelete = async (id: string) => {
    const prof = professionals.find(p => p.id === id);
    const ok = await confirm({
      title: 'Excluir profissional?',
      description: (
        <>
          Tem certeza que deseja excluir <b>{prof?.name ?? 'este profissional'}</b>?<br />
          Esta ação não pode ser desfeita e pode falhar se houver vínculos.
        </>
      ),
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'danger',
      icon: <Trash2 className="w-5 h-5" />,
    });
    if (!ok) return;

    try {
      await deleteProfessional(id);
      success('Profissional excluído.');
    } catch (e) {
      console.error(e);
      error('Não foi possível excluir o profissional (há registros vinculados?).');
    } finally {
      setIsEditModalOpen(false);
      setEditingProfessional(null);
      setSwipeOpenId(null);
      showAll ? refetch({ onlyArchived: true }) : refetch();
    }
  };

  const handlePhotoChange = async (_id: string, _photoFile: File) => {
    // noop
  };

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando profissionais...</div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      {/* Header com faixa abaixo e toggle alinhado à direita */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
        <div className="px-4 sm:px-6 py-4">
          {/* Faixa 1: título */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profissionais</h1>
            {/* Se tiver um menu/sanduíche, pode ficar aqui do lado direito */}
          </div>

          {/* Linha divisória */}
          <div className="mt-3 border-t border-gray-100" />

          {/* Faixa 2: toolbar abaixo da linha, alinhada à direita */}
          <div className="pt-3 flex items-center justify-end">
            <PrettyToggle
              checked={showAll}
              onChange={(v) => setShowAll(v)}
              label="Mostrar desativados"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {professionals.map((p) => {
          const isSwipeOpen = swipeOpenId === p.id;
          return (
            <div key={p.id} className="group">
              <SwipeRow
                rowId={p.id}
                isOpen={isSwipeOpen}
                onOpen={(id) => setSwipeOpenId(id)}
                onClose={() => setSwipeOpenId(null)}
                onEdit={() => openEditById(p.id)}
                onDelete={() => askAndArchive(p.id)} // ação padrão do swipe = Arquivar
              >
                <ProfessionalCard
                  professional={p}
                  onToggle={toggleProfessional}
                  onEdit={openEditById}
                  onDelete={askAndArchive}
                  onPhotoChange={handlePhotoChange}
                />

                {/* Botão REATIVAR: aparece apenas no modo "arquivados" */}
                {showAll && (
  <div className="px-2 pb-2 flex justify-end">
    <ReactivatePill
      onClick={async () => {
        await restoreProfessional(p.id);
        await refetch({ onlyArchived: true });
      }}
    />
  </div>
)}

              </SwipeRow>
            </div>
          );
        })}
      </div>

      <AddProfessionalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}
      />

      <EditProfessionalModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProfessional(null);
        }}
        onUpdate={handleUpdate}
        onArchive={askAndArchive}           // se o seu modal tiver esse botão
        onDelete={askAndDelete}             // admin (não exibido por padrão)
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
