// src/pages/Professionals.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import { replaceProfessionalAvatar } from '../lib/avatars'; // Solução B

const Professionals: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

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

  // ✅ Ajustado para aceitar os campos que o AddProfessionalModal envia
  const handleAdd = async (newProfessional: {
    name: string;
    specialty: string;
    value?: number;
    phone?: string;
    registrationCode: string;
    commissionRate?: number;
  }) => {
    // Se o hook aceitar só alguns campos, o cast mantém compatibilidade.
    await addProfessional(newProfessional as any);
    setIsModalOpen(false);
  };

  // ✅ Já aceita os campos enviados pelo EditProfessionalModal
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
   * Upload de avatar (Solução B):
   * - Usa replaceProfessionalAvatar: sobe arquivo novo, atualiza DB (avatar_path/updated_at) e apaga o antigo
   * - Depois persiste a URL pública no front (campo avatar) para o card refletir
   */
  const handlePhotoChange = async (id: string, photoFile: File) => {
    try {
      setUploadingPhoto(id);
      const { publicUrl } = await replaceProfessionalAvatar(id, photoFile);
      await updateProfessional(id, { avatar: publicUrl } as any);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      alert('Erro ao enviar a foto. Confira as permissões do bucket/policies.');
    } finally {
      setUploadingPhoto(null);
    }
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
            onPhotoChange={handlePhotoChange}
          />
        ))}

        {uploadingPhoto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-700">Alterando foto...</p>
            </div>
          </div>
        )}
      </div>

      <AddProfessionalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAdd}                        // ✅ agora compatível
      />

      <EditProfessionalModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProfessional(null);
        }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}                  // ✅ exclusão dentro do modal
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
