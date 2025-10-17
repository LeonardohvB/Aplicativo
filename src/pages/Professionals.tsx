// src/pages/Professionals.tsx
import React, { useEffect, useState } from 'react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import SwipeRow from '../components/common/SwipeRow';

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
  } = useProfessionals(); // por padrão traz apenas não arquivados

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

  // carrega na montagem
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

  // Desativar (arquivar)
  const askAndArchive = async (id: string) => {
    const prof = professionals.find(p => p.id === id);
    const ok = await confirm({
      title: 'Desativar profissional?',
      description: (
        <>
          Isso irá inativar e esconder <b>{prof?.name ?? 'este profissional'}</b> da lista padrão.
          O histórico será preservado. Você pode reativar depois na tela de desativados.
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

  // Excluir (hard delete) — admin/casos excepcionais
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
      refetch();
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
      {/* Cabeçalho simples — sem cartão/pílula */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profissionais</h1>
       
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
                onDelete={() => askAndArchive(p.id)} // ação do swipe = Desativar (arquivar)
              >
                <ProfessionalCard
                  professional={p}
                  onToggle={toggleProfessional}
                  onEdit={openEditById}
                  onDelete={askAndArchive}
                  onPhotoChange={handlePhotoChange}
                />
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
        onArchive={askAndArchive}  // desativar
        onDelete={askAndDelete}    // hard delete (admin)
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
