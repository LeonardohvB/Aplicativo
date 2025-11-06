// src/pages/Professionals.tsx
import React, { useEffect, useState } from 'react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import SwipeRow from '../components/common/SwipeRow';
import { Archive } from 'lucide-react';


// padrões globais
import { useConfirm } from '../providers/ConfirmProvider';
import { useToast } from '../components/ui/Toast';
import { Trash2 } from 'lucide-react';

const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

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
    const open = () => setIsModalOpen(true);
    window.addEventListener('professionals:add', open);
    return () => window.removeEventListener('professionals:add', open);
  }, []);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    refetch();
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

  if (loading) {
    return (
      <div className="p-6 pb-24 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Carregando profissionais...</div>
      </div>
    );
  }

  // AGRUPA POR ESPECIALIDADE (para layout desktop)
  const grouped = professionals.reduce((acc: any, p: Professional) => {
    const key = p.specialty || "Outros";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profissionais</h1>
      </div>

      {/* MOBILE — lista como já era */}
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

      {/* DESKTOP — agrupar por especialidade lado a lado */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(grouped).map(([specialty, list]: any) => (
          <div key={specialty} className="space-y-3">
            <h2 className="inline-flex items-center px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
              {specialty}
            </h2>

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
        ))}
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
        onArchive={askAndArchive}
        onDelete={askAndDelete}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
