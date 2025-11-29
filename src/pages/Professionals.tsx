// src/pages/Professionals.tsx
import React, { useEffect, useState } from 'react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import SwipeRow from '../components/common/SwipeRow';
import { Archive, Trash2 } from 'lucide-react';

// padrões globais
import { useConfirm } from '../providers/ConfirmProvider';
import { useToast } from '../components/ui/Toast';

const Professionals: React.FC = () => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const confirm = useConfirm();
  const { success, error } = useToast();

  const {
    professionals,
    loading,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
    archiveProfessional,
    refetch,
  } = useProfessionals();

  const openEditById = (id: string) => {
    const professional = professionals.find((p) => p.id === id);
    if (professional) {
      setEditingProfessional(professional);
      setIsEditModalOpen(true);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    refetch();
  };

  const askAndArchive = async (id: string) => {
    const prof = professionals.find(p => p.id === id);
    const ok = await confirm({
      title: 'Arquivar profissional?',
      description: (
        <>
          Isso irá inativar e esconder <b>{prof?.name ?? 'este profissional'}</b> da lista padrão.
          O histórico será preservado. Você pode reativar depois na tela de desativados.
        </>
      ),
      confirmText: 'Arquivar',
      cancelText: 'Cancelar',
      variant: 'danger',
      icon: <Archive className="w-5 h-5 text-yellow-600" />,
    });
    if (!ok) return;

    try {
      await archiveProfessional(id);
      success('Profissional desativado.');
    } catch (e) {
      console.error(e);
      error('Não foi possível desativar o profissional.');
    } finally {
      setIsEditModalOpen(false);
      setEditingProfessional(null);
      setSwipeOpenId(null);
      refetch();
    }
  };

  const askAndDelete = async (id: string) => {
    const prof = professionals.find(p => p.id === id);
    const ok = await confirm({
      title: 'Excluir profissional?',
      description: (
        <>
          Tem certeza que deseja excluir <b>{prof?.name ?? 'este profissional'}</b>?<br />
          Esta ação não pode ser desfeita.
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
      error('Não foi possível excluir o profissional.');
    } finally {
      setIsEditModalOpen(false);
      setEditingProfessional(null);
      setSwipeOpenId(null);
      refetch();
    }
  };

  const handlePhotoChange = async (_id: string, _photoFile: File) => {};

  // ============================
  //   🔵 ESTADO VAZIO
  // ============================

  if (!loading && professionals.length === 0) {
    return (
      <div
        className="
          p-6 bg-gray-50 min-h-[100svh] flex flex-col items-center justify-start pt-20
        "
        style={{
          paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
        }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          Profissionais
        </h1>

        {/* Caixa tracejada igual ao financeiro */}
        <div className="w-full border border-dashed border-blue-300 rounded-xl p-6 text-center text-gray-600 bg-white">
          Nenhum profissional encontrado.
        </div>

        {/* AGORA NAVEGA PARA A NOVA PÁGINA */}
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('navigate', {
                detail: { page: 'professional_new' },
              })
            )
          }
          className="
            mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white shadow
            hover:bg-blue-700 transition
          "
        >
          Cadastrar profissional
        </button>
      </div>
    );
  }

  // ============================

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando profissionais...</div>
      </div>
    );
  }

  // AGRUPA POR ESPECIALIDADE
  const grouped = professionals.reduce((acc: Record<string, Professional[]>, p: Professional) => {
    const key = p.specialty || 'Outros';
    (acc[key] ||= []).push(p);
    return acc;
  }, {});

  const groupEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));

  return (
    <div
      className="
        relative z-0
        p-6 bg-gray-50 min-h-[100svh]
        pb-32 md:pb-10
      "
      style={{
        paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profissionais</h1>
      </div>

      {/* MOBILE */}
      <div className="space-y-4 md:hidden">
        {professionals.map((p) => {
          const isSwipeOpen = swipeOpenId === p.id;
          return (
            <SwipeRow
              key={p.id}
              rowId={p.id}
              isOpen={isSwipeOpen}
              onOpen={(id) => setSwipeOpenId(id)}
              onClose={() => setSwipeOpenId(null)}
              onEdit={() => openEditById(p.id)}
              onDelete={() => askAndArchive(p.id)}
            >
              <ProfessionalCard
                professional={p}
                onToggle={toggleProfessional}
                onEdit={openEditById}
                onDelete={askAndArchive}
                onPhotoChange={handlePhotoChange}
              />
            </SwipeRow>
          );
        })}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:grid gap-6 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {groupEntries.map(([specialty, list]) => (
          <section key={specialty} className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
              <span className="font-medium truncate">{specialty}</span>
              <span className="ml-1 text-[11px] px-2 py-[2px] rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {list.length} {list.length === 1 ? 'profissional' : 'profissionais'}
              </span>
            </div>

            <div className="space-y-3">
              {list.map((p: Professional) => {
                const isSwipeOpen = swipeOpenId === p.id;
                return (
                  <SwipeRow
                    key={p.id}
                    rowId={p.id}
                    isOpen={isSwipeOpen}
                    onOpen={(id) => setSwipeOpenId(id)}
                    onClose={() => setSwipeOpenId(null)}
                    onEdit={() => openEditById(p.id)}
                    onDelete={() => askAndArchive(p.id)}
                  >
                    <ProfessionalCard
                      professional={p}
                      onToggle={toggleProfessional}
                      onEdit={openEditById}
                      onDelete={askAndArchive}
                      onPhotoChange={handlePhotoChange}
                    />
                  </SwipeRow>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="h-8 md:h-0" role="presentation" />

      {/* EDITAR PROFISSIONAL */}
      <EditProfessionalModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProfessional(null);
        }}
        onUpdate={handleUpdate}
        onArchive={askAndArchive}
        onDelete={askAndDelete}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
