// src/pages/Professionals.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';

const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

  const {
    professionals,
    loading,
    addProfessional,
    updateProfessional,
    toggleProfessional,
    deleteProfessional,
  } = useProfessionals();

  const handleEdit = (id: string) => {
    const professional = professionals.find((p) => p.id === id);
    if (professional) {
      setEditingProfessional(professional);
      setIsEditModalOpen(true);
    }
  };

  // ✅ Aceita os campos enviados pelo AddProfessionalModal
  const handleAdd = async (newProfessional: {
    name: string;
    specialty: string;
    value?: number;
    phone?: string;
    registrationCode: string;
    commissionRate?: number;
  }) => {
    await addProfessional(newProfessional as any);
    setIsModalOpen(false);
  };

  // ✅ Aceita os campos enviados pelo EditProfessionalModal
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

  /**
   * Callback chamado pelo ProfessionalCard DEPOIS do upload/limpeza ter sido feito por ele.
   * Não precisamos re-enviar a foto aqui. Mantemos apenas para compatibilidade.
   * Se quiser forçar revalidação da lista, pode chamar updateProfessional(id, {}).
   */
  const handlePhotoChange = async (_id: string, _photoFile: File) => {
    // noop: o card já atualiza o DB e a imagem (cache-busting local)
    // Opcional: await updateProfessional(_id, {} as any);
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {professionals.map((professional) => (
          <ProfessionalCard
            key={professional.id}
            professional={professional}
            onToggle={toggleProfessional}
            onEdit={handleEdit}
            onDelete={handleDelete}              // card não usa, mas mantemos a prop
            onPhotoChange={handlePhotoChange}    // agora é só um ack (sem re-upload)
          />
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
        onDelete={handleDelete}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
