// src/pages/Professionals.tsx
import React, { useEffect, useState } from 'react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import SwipeRow from '../components/common/SwipeRow';

const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);

  const {
    professionals,
    loading,
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
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
  };

  const handleDelete = async (id: string) => {
    await deleteProfessional(id);
    setIsEditModalOpen(false);
    setEditingProfessional(null);
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
      {/* Header sem botão */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
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
                onDelete={() => handleDelete(p.id)}
              >
                <ProfessionalCard
                  professional={p}
                  onToggle={toggleProfessional}
                  onEdit={openEditById}
                  onDelete={handleDelete}
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
        onDelete={handleDelete}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
