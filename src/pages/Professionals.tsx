// src/pages/Professionals.tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ProfessionalCard from '../components/Professionals/ProfessionalCard';
import AddProfessionalModal from '../components/Professionals/AddProfessionalModal';
import EditProfessionalModal from '../components/Professionals/EditProfessionalModal';
import { useProfessionals } from '../hooks/useProfessionals';
import { Professional } from '../types';
import { replaceProfessionalAvatar } from '../lib/avatars'; // << usar Solução B

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

  const handleAdd = async (newProfessional: {
    name: string;
    specialty: string;
    value: number;
  }) => {
    await addProfessional(newProfessional);
    setIsModalOpen(false);
  };

  const handleUpdate = async (id: string, updates: {
    name: string;
    specialty: string;
    value: number;
  }) => {
    await updateProfessional(id, updates);
    setIsEditModalOpen(false);
    setEditingProfessional(null);
  };

  /**
   * Upload de avatar (Solução B):
   * - Usa replaceProfessionalAvatar: sobe arquivo novo, atualiza DB (avatar_path/updated_at) e apaga o antigo
   * - Depois atualiza o campo `avatar` no front para manter compatível com o ProfessionalCard atual
   */
  const handlePhotoChange = async (id: string, photoFile: File) => {
    try {
      setUploadingPhoto(id);

      // Sobe novo arquivo e remove o anterior (no Storage), atualiza avatar_path/updated_at no DB
      const { publicUrl } = await replaceProfessionalAvatar(id, photoFile);

      // Mantém compatibilidade com o componente atual (usa `avatar` como URL pública)
      // Se seu updateProfessional tipar estrito, ajuste a tipagem para aceitar { avatar?: string }
      await updateProfessional(id, { /* outros campos não alterados */ } as any);
      // Atualização leve: se seu updateProfessional não aceitar avatar,
      // você pode disparar um "refetch" no hook. Caso não exista, descomente este setLocal abaixo:
      // setProfessionals(prev => prev.map(p => p.id === id ? { ...p, avatar: publicUrl } : p));

      // Preferível: se updateProfessional aceita atributos livres, faça:
      // await updateProfessional(id, { avatar: publicUrl } as any);

      // --- IMPORTANTE ---
      // Como seu código anterior já fazia `updateProfessional(id, { avatar: publicUrl })`,
      // mantenha a linha abaixo para refletir a nova URL no front:
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
            onDelete={deleteProfessional}
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
        onAdd={handleAdd}
      />

      <EditProfessionalModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProfessional(null);
        }}
        onUpdate={handleUpdate}
        professional={editingProfessional}
      />
    </div>
  );
};

export default Professionals;
